/**
 * /api/trial/* — Free-trial and HIVE token airdrop endpoints.
 *
 * GET  /api/trial/status?wallet=<pubkey>   — trial remaining uses + daily claim eligibility
 * POST /api/trial/use                      — consume one free trial slot (body: { wallet })
 * POST /api/trial/claim                    — claim daily HIVE tokens (body: { wallet, signedTx })
 * GET  /api/trial/config                   — program ID + PDA addresses (for frontend)
 */

import type { FastifyInstance } from "fastify";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("EV447FY9Q7Ty7pFo8wDPFRhkqASmj87GZjFr8CPjQ5om");
const DEVNET_RPC = clusterApiUrl("devnet");
const SECONDS_PER_DAY = 86_400;

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

export async function trialRoutes(app: FastifyInstance) {
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
