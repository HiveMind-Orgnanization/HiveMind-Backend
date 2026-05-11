import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RealtimeHub } from "../services/realtime";
import { hivemindStore } from "../services/store";
import { requireWallet } from "../hooks/auth";

const intent = z.object({
  missionId: z.string(),
  amountSol: z.number().positive(),
  recipientPubkey: z.string().min(32),
});

export async function paymentsRoutes(app: FastifyInstance, hub: RealtimeHub) {
  app.get("/api/payments", async (req) => {
    const q = req.query as { missionId?: string };
    return { payments: await hivemindStore().listPayments(q.missionId) };
  });

  app.post("/api/payments/intent", async (req, reply) => {
    try {
      requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const parsed = intent.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    const st = hivemindStore();
    if (!(await st.getMission(parsed.data.missionId))) return reply.status(404).send({ error: "mission_not_found" });
    const p = await st.createPaymentIntent(parsed.data);
    hub.broadcast({ type: "payment.created", payload: p }, "global");
    // Surface in the notification center with a friendly title/body.
    hub.broadcast(
      {
        type: "payment.settled",
        payload: {
          title: `Payment intent · ${p.missionId}`,
          body: `Queued ${p.amountSol} SOL to ${p.recipientPubkey.slice(0, 6)}…${p.recipientPubkey.slice(-4)}.`,
          missionId: p.missionId,
          amount: `${p.amountSol} SOL`,
          ts: Date.now(),
        },
      },
      "global",
    );
    return {
      payment: p,
      instruction:
        "Submit signed Solana transaction against hivemind-contracts escrow · backend records intent only in MVP",
    };
  });
}
