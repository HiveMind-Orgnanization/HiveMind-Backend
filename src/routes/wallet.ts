import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { AppConfig } from "../config/env";

export async function walletRoutes(app: FastifyInstance, cfg: AppConfig) {
  app.get("/api/wallet/:pubkey/balance", async (req, reply) => {
    const pubkey = (req.params as { pubkey: string }).pubkey;
    try {
      new PublicKey(pubkey);
    } catch {
      return reply.status(400).send({ error: "invalid_pubkey" });
    }
    if (!cfg.SOLANA_RPC_URL) {
      return { pubkey, lamports: null, sol: null, source: "rpc_disabled" };
    }
    try {
      const conn = new Connection(cfg.SOLANA_RPC_URL, "confirmed");
      const lamports = await conn.getBalance(new PublicKey(pubkey));
      return { pubkey, lamports, sol: lamports / LAMPORTS_PER_SOL, source: "rpc" };
    } catch {
      return reply.status(502).send({ error: "rpc_error" });
    }
  });

  const treasuryStub = z.object({
    pubkey: z.string(),
  });

  app.post("/api/wallet/treasury-summary", async (req) => {
    const body = treasuryStub.safeParse(req.body);
    const pk = body.success ? body.data.pubkey : "treasury";
    return {
      pubkey: pk,
      allocatedSol: 214.1,
      escrowSol: 62.4,
      payoutsSol: 32.92,
      reserveSol: 9.0,
      note: "stub · wire Anchor treasury program for production",
    };
  });
}
