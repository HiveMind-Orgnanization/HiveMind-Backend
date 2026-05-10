import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hivemindStore } from "../services/store";
import type { MemoryChunk } from "../types/domain";

const recall = z.object({
  query: z.string().min(1),
  topK: z.coerce.number().min(1).max(50).default(8),
  missionId: z.string().optional(),
});

export async function memoryRoutes(app: FastifyInstance) {
  app.post("/api/memory/query", async (req, reply) => {
    const parsed = recall.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    let chunks = await hivemindStore().searchMemory(parsed.data.query, parsed.data.topK);
    if (parsed.data.missionId) {
      chunks = chunks.filter((c: MemoryChunk) => !c.missionId || c.missionId === parsed.data.missionId);
    }
    return {
      query: parsed.data.query,
      matches: chunks.map((c: MemoryChunk) => ({
        id: c.id,
        missionId: c.missionId,
        text: c.text,
        relevance: c.score ?? 0.82,
      })),
      note: "MVP keyword ranking · swap Qdrant embeddings for production",
    };
  });

  app.get("/api/memory/chunks", async () => ({
    chunks: await hivemindStore().listMemoryChunks(),
  }));
}
