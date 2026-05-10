import type { FastifyInstance } from "fastify";
import { hivemindStore } from "../services/store";
import type { AgentProfile } from "../types/domain";

export async function reputationRoutes(app: FastifyInstance) {
  app.get("/api/reputation", async () => {
    const agents = await hivemindStore().listAgents();
    const leaderboard = agents
      .map((a: AgentProfile) => ({
        agentId: a.id,
        name: a.name,
        specialization: a.specialization,
        trustScore: a.trustScore,
        reputation: a.reputation,
        missionsCompleted: a.missionsCompleted,
      }))
      .sort((a: { trustScore: number }, b: { trustScore: number }) => b.trustScore - a.trustScore);
    return { leaderboard };
  });

  app.get("/api/reputation/:agentId", async (req, reply) => {
    const agentId = (req.params as { agentId: string }).agentId;
    const a = await hivemindStore().getAgent(agentId);
    if (!a) return reply.status(404).send({ error: "not_found" });
    return {
      agentId: a.id,
      name: a.name,
      specialization: a.specialization,
      trustScore: a.trustScore,
      reputation: a.reputation,
      missionsCompleted: a.missionsCompleted,
      note: "on-chain reputation · integrate hivemind-contracts program",
    };
  });
}
