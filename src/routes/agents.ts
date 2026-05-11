import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config/env";
import { requireWallet } from "../hooks/auth";
import type { RealtimeHub } from "../services/realtime";
import {
  buildArtifactContextUserBlock,
  isAllowedMissionArtifactPath,
  languageFromArtifactPath,
  latestArtifactsByPath,
  parsePersistArtifactReply,
} from "../services/agent-invoke-artifacts";
import { invokeAgentCompletion, isOpenAiModel } from "../services/agent-runtime";
import { sanitizeViteApiUrlDoubleApi } from "../services/preview-manager";
import { hivemindStore } from "../services/store";

const invokeBody = z.object({
  message: z.string().min(1).max(12000),
  missionId: z.string().optional(),
  /** When missionId set, prepend latest artifact bodies (default true). */
  includeArtifacts: z.boolean().optional().default(true),
  /** Require JSON `{ assistantReply, fileUpdates[] }` and persist fileUpdates to mission_artifacts. */
  persistArtifactUpdates: z.boolean().optional().default(false),
  /** OpenAI chat model id when OPENAI_API_KEY is set (overridden by env OPENAI_MODEL_ALL). */
  model: z.string().max(128).optional(),
});

/** Per-process in-memory store of background invokes — purged after 15 min. */
type InvokeJob = {
  status: "running" | "done" | "failed";
  startedAt: number;
  wallet: string;
  agentId: string;
  result?: InvokeJobResult;
  error?: string;
};
type InvokeJobResult = {
  agentId: string;
  name: string;
  reply: string;
  provider: string;
  model: string;
  debugLlm?: string;
  artifactPathsApplied?: string[];
  persistArtifactParseFailed?: boolean;
};
const invokeJobs = new Map<string, InvokeJob>();
function cleanupInvokeJobs() {
  const cutoff = Date.now() - 15 * 60_000;
  for (const [k, v] of invokeJobs) {
    if (v.startedAt < cutoff) invokeJobs.delete(k);
  }
}

export async function agentsRoutes(app: FastifyInstance, hub: RealtimeHub, cfg: AppConfig) {
  app.get("/api/agents", async () => ({ agents: await hivemindStore().listAgents() }));

  app.get("/api/agents/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const agent = await hivemindStore().getAgent(id);
    if (!agent) return reply.status(404).send({ error: "not_found" });
    return agent;
  });

  /** Wallet-authenticated agent turn (Groq when GROQ_API_KEY set, else mock). */
  app.post("/api/agents/:id/invoke", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const id = (req.params as { id: string }).id;
    const parsed = invokeBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const { message, missionId, includeArtifacts, persistArtifactUpdates, model: bodyModel } = parsed.data;
    if (persistArtifactUpdates && !missionId) {
      return reply
        .status(400)
        .send({ error: "persist_requires_mission_id", detail: "pass missionId to save file updates." });
    }
    const st = hivemindStore();
    const agent = await st.getAgent(id);
    if (!agent) return reply.status(404).send({ error: "agent_not_found" });

    let missionObjective: string | undefined;
    if (missionId) {
      const m = await st.getMission(missionId);
      if (!m) return reply.status(404).send({ error: "mission_not_found" });
      missionObjective = `${m.title}\n${m.objective}`;
    }

    let userMessageForModel = message;
    /** Persisting edits without file context invites broken applies — bundle artifacts whenever either flag asks. */
    const attachArtifacts = Boolean(missionId && (includeArtifacts || persistArtifactUpdates));
    let artifactHeavy = attachArtifacts || Boolean(persistArtifactUpdates && missionId);

    if (attachArtifacts && missionId) {
      const artifacts = await st.listMissionArtifacts(wallet, missionId);
      const latest = latestArtifactsByPath(artifacts);
      if (latest.length > 0) {
        const block = buildArtifactContextUserBlock(latest, {
          maxTotalChars: persistArtifactUpdates ? 20_000 : 14_000,
          maxFileChars: persistArtifactUpdates ? 16_000 : 12_000,
        });
        userMessageForModel = `${block}\n\n---\n## Operator message\n\n${message}`;
        artifactHeavy = true;
      }
    }

    const modelOverride =
      bodyModel?.trim() && isOpenAiModel(bodyModel.trim()) ? bodyModel.trim() : undefined;
    const result = await invokeAgentCompletion(cfg, agent, userMessageForModel, missionObjective, {
      artifactHeavy,
      persistArtifactUpdates: Boolean(persistArtifactUpdates && missionId),
      ...(modelOverride ? { modelOverride } : {}),
    });

    let replyText = result.reply;
    /** Paths written when `persistArtifactUpdates` parses and validates. */
    let artifactPathsApplied: string[] | undefined;
    let persistArtifactParseFailed = false;

    if (persistArtifactUpdates && missionId) {
      const parsedPersist = parsePersistArtifactReply(result.reply);
      if (parsedPersist.ok) {
        replyText = parsedPersist.data.assistantReply.trim() || result.reply;
        const applied: string[] = [];
        for (const u of parsedPersist.data.fileUpdates ?? []) {
          const rel = u.path.replace(/\\/g, "/").trim().replace(/^\/+/, "");
          if (!isAllowedMissionArtifactPath(rel)) continue;
          const raw = typeof u.content === "string" ? u.content : "";
          const content = sanitizeViteApiUrlDoubleApi(rel, raw);
          await st.createMissionArtifact({
            missionId,
            wallet,
            agent: agent.name,
            role: agent.specialization,
            kind: "file",
            path: rel,
            language: u.language ?? languageFromArtifactPath(rel),
            content,
          });
          applied.push(rel);
        }
        if (applied.length > 0) artifactPathsApplied = applied;
      } else {
        persistArtifactParseFailed = true;
        if (cfg.NODE_ENV === "development") {
          replyText =
            `${result.reply}\n\n_(dev note: persistArtifactUpdates was set but JSON was not usable; reply left raw.)_`;
        }
      }
    }

    const payload: {
      agentId: string;
      name: string;
      reply: string;
      provider: string;
      model: string;
      debugLlm?: string;
      artifactPathsApplied?: string[];
      persistArtifactParseFailed?: boolean;
    } = {
      agentId: agent.id,
      name: agent.name,
      reply: replyText,
      provider: result.provider,
      model: result.model,
    };
    if (persistArtifactParseFailed) payload.persistArtifactParseFailed = true;
    if (artifactPathsApplied?.length) payload.artifactPathsApplied = artifactPathsApplied;
    if (cfg.NODE_ENV === "development" && result.llmFailure) {
      payload.debugLlm = result.llmFailure.slice(0, 1200);
    }

    const activity = {
      agent: agent.name,
      message: `${result.provider === "groq" ? "[groq] " : "[mock] "}${replyText.slice(0, 560)}`,
      ts: Date.now(),
    };
    hub.broadcast({ type: "agent.activity", payload: activity }, "global");
    if (missionId) {
      hub.broadcast({ type: "agent.activity", payload: activity }, `mission:${missionId}`);
    }

    return payload;
  });

  /**
   * POST /api/agents/:id/invoke-async — non-blocking variant.
   * Returns 202 + jobId immediately, runs the LLM call in the background, frontend polls
   * /invoke-status/:jobId. Bypasses the 30 s Vercel rewrite timeout that was making every
   * auto-fix and follow-up chat call fail with "network" before the model could finish.
   */
  app.post("/api/agents/:id/invoke-async", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    cleanupInvokeJobs();
    const agentId = (req.params as { id: string }).id;
    const parsed = invokeBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const { message, missionId, includeArtifacts, persistArtifactUpdates, model: bodyModel } = parsed.data;
    if (persistArtifactUpdates && !missionId) {
      return reply
        .status(400)
        .send({ error: "persist_requires_mission_id", detail: "pass missionId to save file updates." });
    }
    const st = hivemindStore();
    const agent = await st.getAgent(agentId);
    if (!agent) return reply.status(404).send({ error: "agent_not_found" });

    const jobId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    invokeJobs.set(jobId, { status: "running", startedAt: Date.now(), wallet, agentId });
    void reply.status(202).send({ jobId, status: "running" });

    // Run the same logic as the sync route but off the request-response cycle.
    void (async () => {
      try {
        let missionObjective: string | undefined;
        if (missionId) {
          const m = await st.getMission(missionId);
          if (!m) {
            invokeJobs.set(jobId, { status: "failed", startedAt: Date.now(), wallet, agentId, error: "mission_not_found" });
            return;
          }
          missionObjective = `${m.title}\n${m.objective}`;
        }

        let userMessageForModel = message;
        const attachArtifacts = Boolean(missionId && (includeArtifacts || persistArtifactUpdates));
        let artifactHeavy = attachArtifacts || Boolean(persistArtifactUpdates && missionId);

        if (attachArtifacts && missionId) {
          const artifacts = await st.listMissionArtifacts(wallet, missionId);
          const latest = latestArtifactsByPath(artifacts);
          if (latest.length > 0) {
            const block = buildArtifactContextUserBlock(latest, {
              maxTotalChars: persistArtifactUpdates ? 20_000 : 14_000,
              maxFileChars: persistArtifactUpdates ? 16_000 : 12_000,
            });
            userMessageForModel = `${block}\n\n---\n## Operator message\n\n${message}`;
            artifactHeavy = true;
          }
        }

        const modelOverride =
          bodyModel?.trim() && isOpenAiModel(bodyModel.trim()) ? bodyModel.trim() : undefined;
        const result = await invokeAgentCompletion(cfg, agent, userMessageForModel, missionObjective, {
          artifactHeavy,
          persistArtifactUpdates: Boolean(persistArtifactUpdates && missionId),
          ...(modelOverride ? { modelOverride } : {}),
        });

        let replyText = result.reply;
        let artifactPathsApplied: string[] | undefined;
        let persistArtifactParseFailed = false;

        if (persistArtifactUpdates && missionId) {
          const parsedPersist = parsePersistArtifactReply(result.reply);
          if (parsedPersist.ok) {
            replyText = parsedPersist.data.assistantReply.trim() || result.reply;
            const applied: string[] = [];
            for (const u of parsedPersist.data.fileUpdates ?? []) {
              const rel = u.path.replace(/\\/g, "/").trim().replace(/^\/+/, "");
              if (!isAllowedMissionArtifactPath(rel)) continue;
              const raw = typeof u.content === "string" ? u.content : "";
              const content = sanitizeViteApiUrlDoubleApi(rel, raw);
              await st.createMissionArtifact({
                missionId,
                wallet,
                agent: agent.name,
                role: agent.specialization,
                kind: "file",
                path: rel,
                language: u.language ?? languageFromArtifactPath(rel),
                content,
              });
              applied.push(rel);
            }
            if (applied.length > 0) artifactPathsApplied = applied;
          } else {
            persistArtifactParseFailed = true;
          }
        }

        const payload: InvokeJobResult = {
          agentId: agent.id,
          name: agent.name,
          reply: replyText,
          provider: result.provider,
          model: result.model,
        };
        if (persistArtifactParseFailed) payload.persistArtifactParseFailed = true;
        if (artifactPathsApplied?.length) payload.artifactPathsApplied = artifactPathsApplied;
        if (cfg.NODE_ENV === "development" && result.llmFailure) {
          payload.debugLlm = result.llmFailure.slice(0, 1200);
        }

        invokeJobs.set(jobId, { status: "done", startedAt: Date.now(), wallet, agentId, result: payload });

        const activity = {
          agent: agent.name,
          message: `${result.provider === "groq" ? "[groq] " : "[mock] "}${replyText.slice(0, 560)}`,
          ts: Date.now(),
        };
        hub.broadcast({ type: "agent.activity", payload: activity }, "global");
        if (missionId) hub.broadcast({ type: "agent.activity", payload: activity }, `mission:${missionId}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        invokeJobs.set(jobId, { status: "failed", startedAt: Date.now(), wallet, agentId, error: msg });
      }
    })();
  });

  /** GET /api/agents/:id/invoke-status/:jobId — poll until status !== "running". */
  app.get("/api/agents/:id/invoke-status/:jobId", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const { jobId } = req.params as { id: string; jobId: string };
    const job = invokeJobs.get(jobId);
    if (!job) return reply.status(404).send({ error: "not_found", message: "Invoke job not found or expired." });
    if (job.wallet !== wallet) return reply.status(403).send({ error: "forbidden" });
    return { status: job.status, result: job.result ?? null, error: job.error ?? null };
  });
}
