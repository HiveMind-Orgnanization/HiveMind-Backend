import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { AppConfig } from "./config/env";
import { registerAuthHooks } from "./hooks/auth";
import { RealtimeHub, attachDemoPulse } from "./services/realtime";
import { closeStore } from "./services/store";
import { authRoutes } from "./routes/auth";
import { agentsRoutes } from "./routes/agents";
import { missionsRoutes } from "./routes/missions";
import { walletRoutes } from "./routes/wallet";
import { reputationRoutes } from "./routes/reputation";
import { tasksRoutes } from "./routes/tasks";
import { paymentsRoutes } from "./routes/payments";
import { memoryRoutes } from "./routes/memory";
import { trialRoutes } from "./routes/trial";

export async function buildApp(cfg: AppConfig) {
  const app = Fastify({
    logger: cfg.NODE_ENV !== "test" ? { level: cfg.LOG_LEVEL } : false,
  });

  await app.register(cors, {
    origin: cfg.CORS_ORIGIN === "*" ? true : cfg.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  });

  registerAuthHooks(app, cfg);

  const hub = new RealtimeHub();

  await app.register(websocket);

  app.setErrorHandler((err: unknown, _req, reply) => {
    const status =
      err &&
      typeof err === "object" &&
      "statusCode" in err &&
      typeof (err as { statusCode: unknown }).statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    const code = safeStatus >= 500 ? "internal_error" : err instanceof Error ? err.message : "error";
    if (safeStatus >= 500) app.log.error(err);
    return reply.status(safeStatus).send({ error: code });
  });

  app.get("/health", async () => ({
    ok: true,
    service: "hivemind-backend",
    ts: Date.now(),
  }));

  await authRoutes(app, cfg);
  await agentsRoutes(app, hub, cfg);
  await missionsRoutes(app, hub, cfg);
  await walletRoutes(app, cfg);
  await reputationRoutes(app);
  await tasksRoutes(app, hub);
  await paymentsRoutes(app, hub);
  await memoryRoutes(app);
  await trialRoutes(app);

  app.get("/ws", { websocket: true }, (socket, _req) => {
    hub.add(socket);
  });

  const stopPulse = attachDemoPulse(hub, cfg);

  app.addHook("onClose", async () => {
    stopPulse();
    await closeStore();
  });

  app.decorate("hivemindHub", hub);

  return { app, hub };
}
