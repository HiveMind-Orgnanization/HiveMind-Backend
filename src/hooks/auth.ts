import type { FastifyRequest } from "fastify";
import type { AppConfig } from "../config/env";
import { verifySessionJwt } from "../auth/wallet";

export function registerAuthHooks(app: import("fastify").FastifyInstance, cfg: AppConfig) {
  app.addHook("preHandler", async (req: FastifyRequest) => {
    req.wallet = undefined;
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (!token) return;
    const session = verifySessionJwt(token, cfg);
    if (session) req.wallet = session.wallet;
  });
}

export function requireWallet(req: FastifyRequest): string {
  const w = req.wallet;
  if (!w) throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  return w;
}
