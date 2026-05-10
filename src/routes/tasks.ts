import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RealtimeHub } from "../services/realtime";
import { hivemindStore } from "../services/store";

const createTask = z.object({
  missionId: z.string(),
  title: z.string().min(1),
  agent: z.string().min(1),
  status: z.enum(["queued", "active", "done", "failed"]).default("queued"),
  stage: z.string().optional(),
});

export async function tasksRoutes(app: FastifyInstance, hub: RealtimeHub) {
  app.get("/api/tasks", async (req) => {
    const q = req.query as { missionId?: string };
    return { tasks: await hivemindStore().listTasks(q.missionId) };
  });

  app.patch("/api/tasks/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = createTask.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    const st = hivemindStore();
    const next = await st.patchTask(id, parsed.data);
    if (!next) return reply.status(404).send({ error: "not_found" });
    hub.broadcast({ type: "task.updated", payload: next }, `mission:${next.missionId}`);
    hub.broadcast({ type: "task.updated", payload: next }, "global");
    return next;
  });

  app.post("/api/tasks", async (req, reply) => {
    const parsed = createTask.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    const st = hivemindStore();
    if (!(await st.getMission(parsed.data.missionId))) return reply.status(404).send({ error: "mission_not_found" });
    const t = await st.createTask(parsed.data);
    hub.broadcast({ type: "task.created", payload: t }, `mission:${parsed.data.missionId}`);
    hub.broadcast({ type: "task.created", payload: t }, "global");
    return t;
  });
}
