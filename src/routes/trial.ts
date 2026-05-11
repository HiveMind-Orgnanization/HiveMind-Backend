/**
 * /api/trial/* — Free-trial and HIVE token airdrop endpoints.
 *
 * GET  /api/trial/status?wallet=<pubkey>   — trial remaining uses + daily claim eligibility
 * POST /api/trial/use                      — consume one free trial slot (body: { wallet })
 * POST /api/trial/claim                    — claim daily HIVE tokens (body: { wallet, signedTx })
 * GET  /api/trial/config                   — program ID + PDA addresses (for frontend)
 */

import type { FastifyInstance } from "fastify";
import { notif, type RealtimeHub } from "../services/realtime";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import bs58 from "bs58";

const PROGRAM_ID = new PublicKey("EV447FY9Q7Ty7pFo8wDPFRhkqASmj87GZjFr8CPjQ5om");
const DEVNET_RPC = clusterApiUrl("devnet");
const SECONDS_PER_DAY = 86_400;

/**
 * Funder keypair used to top-up brand-new wallets so they can pay the rent + fee for the
 * register_user instruction on devnet (free-tier faucet airdrops are rate-limited and unreliable).
 * Accepts either a JSON byte array `[1,2,3,…]` or a base58-encoded secret key in the env var
 * FUNDER_SECRET_KEY. Returns null if not configured — fund-wallet endpoint then no-ops with a
 * helpful error so the UI can surface it.
 */
function loadFunderKeypair(): Keypair | null {
  const raw = process.env.FUNDER_SECRET_KEY?.trim();
  if (!raw) return null;
  try {
    if (raw.startsWith("[")) {
      const bytes = JSON.parse(raw) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(bytes));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch (e) {
    console.warn("[trial] FUNDER_SECRET_KEY is set but couldn't be parsed:", (e as Error).message);
    return null;
  }
}

/** Amount transferred to brand-new wallets (covers register_user rent + fee with headroom). */
const FUND_AMOUNT_LAMPORTS = 5_000_000; // 0.005 SOL
/** Don't fund wallets that already have enough — keep funder solvent. */
const FUND_THRESHOLD_LAMPORTS = 3_000_000; // 0.003 SOL

function getPDAs() {
  const [hivemindConfig] = PublicKey.findProgramAddressSync([Buffer.from("hivemind_config")], PROGRAM_ID);
  const [freeTrialConfig] = PublicKey.findProgramAddressSync([Buffer.from("free_trial_config")], PROGRAM_ID);
  const [tokenMint] = PublicKey.findProgramAddressSync([Buffer.from("hive_token_mint")], PROGRAM_ID);
  return { hivemindConfig, freeTrialConfig, tokenMint };
}

function getUserTrial(wallet: PublicKey) {
  const [userTrial] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_trial"), wallet.toBuffer()],
    PROGRAM_ID,
  );
  return userTrial;
}

function getConnection() {
  return new Connection(DEVNET_RPC, "confirmed");
}

/** Read raw account data and parse UserFreeTrial layout manually (8-byte discriminator first). */
async function fetchUserTrialRaw(connection: Connection, wallet: PublicKey) {
  const addr = getUserTrial(wallet);
  const info = await connection.getAccountInfo(addr);
  if (!info) return null;

  // Layout (after 8-byte discriminator):
  // wallet: Pubkey (32), uses_remaining: u8 (1), uses_total: u64 (8),
  // last_daily_claim_ts: i64 (8), daily_claims_total: u64 (8), initialized_at: i64 (8), bump: u8 (1)
  const data = info.data;
  let offset = 8; // skip discriminator
  offset += 32; // wallet pubkey
  const usesRemaining = data[offset];
  offset += 1;
  const usesTotal = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const lastClaimTs = Number(data.readBigInt64LE(offset));
  offset += 8;
  const dailyClaimsTotal = Number(data.readBigUInt64LE(offset));

  const nowSec = Math.floor(Date.now() / 1000);
  const canClaimDaily = lastClaimTs === 0 || nowSec - lastClaimTs >= SECONDS_PER_DAY;
  const nextClaimAt = lastClaimTs === 0 ? null : (lastClaimTs + SECONDS_PER_DAY) * 1000;

  return {
    address: addr.toBase58(),
    usesRemaining,
    usesTotal,
    lastClaimTs,
    dailyClaimsTotal,
    canClaimDaily,
    nextClaimAt,
  };
}

export async function trialRoutes(app: FastifyInstance, hub?: RealtimeHub) {
  const { hivemindConfig, freeTrialConfig, tokenMint } = getPDAs();

  // Static config — no RPC needed
  app.get("/api/trial/config", async () => ({
    programId: PROGRAM_ID.toBase58(),
    cluster: "devnet",
    pdas: {
      hivemindConfig: hivemindConfig.toBase58(),
      freeTrialConfig: freeTrialConfig.toBase58(),
      tokenMint: tokenMint.toBase58(),
    },
    freeUsesTotal: 10,
    dailyTokens: "10 HIVE",
  }));

  // GET /api/trial/status?wallet=<pubkey>
  app.get("/api/trial/status", async (req, reply) => {
    const { wallet } = req.query as { wallet?: string };
    if (!wallet) return reply.status(400).send({ error: "wallet query param required" });

    let pk: PublicKey;
    try { pk = new PublicKey(wallet); } catch { return reply.status(400).send({ error: "invalid_pubkey" }); }

    try {
      const conn = getConnection();
      const trial = await fetchUserTrialRaw(conn, pk);

      if (!trial) {
        return {
          wallet,
          registered: false,
          usesRemaining: 0,
          canClaimDaily: false,
          nextClaimAt: null,
          message: "Wallet not registered — call /api/trial/register first",
        };
      }

      return {
        wallet,
        registered: true,
        userTrialAddress: trial.address,
        usesRemaining: trial.usesRemaining,
        usesTotal: trial.usesTotal,
        dailyClaimsTotal: trial.dailyClaimsTotal,
        canClaimDaily: trial.canClaimDaily,
        nextClaimAt: trial.nextClaimAt,
        tokenMint: tokenMint.toBase58(),
      };
    } catch (err) {
      app.log.error(err, "trial/status rpc error");
      return reply.status(502).send({ error: "rpc_error" });
    }
  });

  /**
   * POST /api/trial/fund-wallet
   * Body: { wallet: <base58 pubkey> }
   * Transfers 0.005 SOL from FUNDER_SECRET_KEY → caller's wallet when the caller's balance
   * is below FUND_THRESHOLD_LAMPORTS. This lets brand-new wallets pay the rent + fee for
   * register_user on devnet without depending on the unreliable public faucet.
   * Idempotent + cheap: skipped when the wallet already has enough SOL.
   */
  app.post("/api/trial/fund-wallet", async (req, reply) => {
    const { wallet } = (req.body ?? {}) as { wallet?: string };
    if (!wallet) return reply.status(400).send({ error: "wallet required" });
    let pk: PublicKey;
    try { pk = new PublicKey(wallet); } catch { return reply.status(400).send({ error: "invalid_pubkey" }); }

    const funder = loadFunderKeypair();
    if (!funder) {
      return reply.status(503).send({
        error: "funder_not_configured",
        message: "Set FUNDER_SECRET_KEY on the backend (JSON byte array or base58 secret) so we can sponsor new wallets.",
      });
    }

    const conn = getConnection();
    try {
      const userBalance = await conn.getBalance(pk, "confirmed");
      if (userBalance >= FUND_THRESHOLD_LAMPORTS) {
        return { ok: true, skipped: true, balance: userBalance, message: "Wallet already funded." };
      }
      const funderBalance = await conn.getBalance(funder.publicKey, "confirmed");
      if (funderBalance < FUND_AMOUNT_LAMPORTS + 5_000) {
        return reply.status(503).send({
          error: "funder_drained",
          message: `Funder wallet (${funder.publicKey.toBase58()}) is empty. Top it up on devnet and retry.`,
        });
      }
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: funder.publicKey,
          toPubkey: pk,
          lamports: FUND_AMOUNT_LAMPORTS,
        }),
      );
      const latest = await conn.getLatestBlockhash("confirmed");
      tx.recentBlockhash = latest.blockhash;
      tx.feePayer = funder.publicKey;
      tx.sign(funder);
      const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
      await conn.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      hub?.broadcast(
        {
          type: "payment.wallet_funded",
          payload: notif({
            title: "Wallet sponsored on devnet",
            body: `${wallet.slice(0, 6)}…${wallet.slice(-4)} received ${FUND_AMOUNT_LAMPORTS / LAMPORTS_PER_SOL} SOL to cover registration rent.`,
            amount: `${FUND_AMOUNT_LAMPORTS / LAMPORTS_PER_SOL} SOL`,
          }),
        },
        "global",
      );
      return {
        ok: true,
        funded: true,
        amountLamports: FUND_AMOUNT_LAMPORTS,
        amountSol: FUND_AMOUNT_LAMPORTS / LAMPORTS_PER_SOL,
        signature: sig,
      };
    } catch (err) {
      app.log.error(err, "trial/fund-wallet failed");
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ error: "fund_failed", message: msg.slice(0, 400) });
    }
  });

  // POST /api/trial/register — inform backend that frontend sent registerUser tx
  app.post("/api/trial/register", async (req, reply) => {
    const { wallet } = req.body as { wallet?: string };
    if (!wallet) return reply.status(400).send({ error: "wallet required" });

    let pk: PublicKey;
    try { pk = new PublicKey(wallet); } catch { return reply.status(400).send({ error: "invalid_pubkey" }); }

    // Just confirm the account exists on-chain (frontend sends the actual tx)
    const conn = getConnection();
    const trial = await fetchUserTrialRaw(conn, pk);
    if (!trial) {
      return reply.status(404).send({ error: "user_trial_not_found", message: "Send registerUser transaction first" });
    }
    hub?.broadcast(
      {
        type: "mission.trial_activated",
        payload: notif({
          title: "Free trial activated",
          body: `Wallet ${wallet.slice(0, 6)}…${wallet.slice(-4)} unlocked ${trial.usesRemaining} free missions.`,
        }),
      },
      "global",
    );
    return { ok: true, usesRemaining: trial.usesRemaining };
  });

  // POST /api/trial/use — record that a free trial was consumed (tx sent by frontend)
  app.post("/api/trial/use", async (req, reply) => {
    const { wallet } = req.body as { wallet?: string };
    if (!wallet) return reply.status(400).send({ error: "wallet required" });

    let pk: PublicKey;
    try { pk = new PublicKey(wallet); } catch { return reply.status(400).send({ error: "invalid_pubkey" }); }

    const conn = getConnection();
    const trial = await fetchUserTrialRaw(conn, pk);
    if (!trial) return reply.status(404).send({ error: "user_trial_not_found" });

    hub?.broadcast(
      {
        type: "payment.trial_used",
        payload: notif({
          title: "Free credit used",
          body: `${wallet.slice(0, 6)}…${wallet.slice(-4)} consumed one free trial — ${trial.usesRemaining}/${trial.usesTotal} left.`,
        }),
      },
      "global",
    );
    return {
      ok: true,
      usesRemaining: trial.usesRemaining,
      usesTotal: trial.usesTotal,
    };
  });

  // POST /api/trial/claim — confirm daily token claim state after frontend tx
  app.post("/api/trial/claim", async (req, reply) => {
    const { wallet } = req.body as { wallet?: string };
    if (!wallet) return reply.status(400).send({ error: "wallet required" });

    let pk: PublicKey;
    try { pk = new PublicKey(wallet); } catch { return reply.status(400).send({ error: "invalid_pubkey" }); }

    const conn = getConnection();
    const trial = await fetchUserTrialRaw(conn, pk);
    if (!trial) return reply.status(404).send({ error: "user_trial_not_found" });

    return {
      ok: true,
      dailyClaimsTotal: trial.dailyClaimsTotal,
      canClaimDaily: trial.canClaimDaily,
      nextClaimAt: trial.nextClaimAt,
    };
  });
}
