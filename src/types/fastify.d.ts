import "fastify";
import type { RealtimeHub } from "../services/realtime";

declare module "fastify" {
  interface FastifyRequest {
    wallet?: string;
  }

  interface FastifyInstance {
    hivemindHub: RealtimeHub;
  }
}
