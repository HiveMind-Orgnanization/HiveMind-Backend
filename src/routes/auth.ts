import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config/env";
import { verifyWalletSignature, signSessionJwt } from "../auth/wallet";
import { hivemindStore } from "../services/store";
import { PublicKey } from "@solana/web3.js";

const walletParam = z.object({
  wallet: z.string().min(1),
});

const verifyBody = z.object({
  wallet: z.string(),
  message: z.string(),
  signature: z.string(),
});

export async function authRoutes(app: FastifyInstance, cfg: AppConfig) {
  app.get("/api/auth/challenge", async (req, reply) => {
    const q = walletParam.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: "invalid_wallet" });
    try {
      new PublicKey(q.data.wallet);
    } catch {
      return reply.status(400).send({ error: "invalid_wallet_pubkey" });
    }
    const challenge = await hivemindStore().createChallenge(q.data.wallet);
    return { challenge: challenge.message, expiresAt: challenge.expiresAt };
  });

  app.post("/api/auth/verify", async (req, reply) => {
    const body = verifyBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "invalid_body" });
    const wallet = body.data.wallet;
    let pk: PublicKey;
    try {
      pk = new PublicKey(wallet);
    } catch {
      return reply.status(400).send({ error: "invalid_wallet_pubkey" });
    }
    const challenge = await hivemindStore().consumeChallenge(pk.toBase58());
    if (!challenge) return reply.status(400).send({ error: "challenge_missing_or_expired" });

    const ok = verifyWalletSignature({
      wallet: pk.toBase58(),
      message: body.data.message,
      signatureBase58: body.data.signature,
      challenge,
    });
    if (!ok) return reply.status(401).send({ error: "invalid_signature" });

    const token = signSessionJwt(pk.toBase58(), cfg);
    return { token, wallet: pk.toBase58() };
  });
}
