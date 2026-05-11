import type { AppConfig } from "../config/env";
import type { AgentProfile } from "../types/domain";
import OpenAI from "openai";

const AGENT_TOOLS: Record<string, string[]> = {
  Strategy: ["chain.reason", "memory.recall", "delegate.peer", "summarize.context"],
  Research: ["vector.search", "browser.fetch", "memory.recall", "summarize.context"],
  Design: ["tools.call(generate_image)", "memory.recall", "chain.reason"],
  Development: ["code.diff", "db.query", "chain.reason"],
  Marketing: ["summarize.context", "delegate.peer", "memory.recall"],
  Treasury: ["ledger.write", "chain.tx", "memory.recall"],
  Analytics: ["vector.search", "db.query", "summarize.context"],
  Coordination: ["graph.traverse", "delegate.peer", "memory.recall"],
  Memory: ["vector.search", "memory.recall", "summarize.context"],
};

function toolsFor(agent: AgentProfile): string[] {
  return (
    AGENT_TOOLS[agent.specialization] ?? ["memory.recall", "chain.reason", "summarize.context"]
  );
}

type BuildPromptOpts = {
  /**
   * Swarm pipeline step: avoid "bullet paragraphs" when the user mandates STRICT JSON deliverables.
   * Uses a minimal system prompt so the model follows the user template (especially Development / Coordination).
   */
  swarmArtifactStep?: boolean;
};

const JSON_ARTIFACT_SPECIALIZATIONS = new Set(["Development", "Coordination", "Design"]);

function buildSystemPrompt(agent: AgentProfile, missionObjective?: string, opts?: BuildPromptOpts): string {
  if (opts?.swarmArtifactStep) {
    const mission = missionObjective?.trim()
      ? `\nMission anchor:\n${missionObjective.slice(0, 4000)}`
      : "";
    if (JSON_ARTIFACT_SPECIALIZATIONS.has(agent.specialization)) {
      const hiveMindFetch =
        agent.specialization === "Development" || agent.specialization === "Coordination"
          ? [
              "HiveMind preview injects import.meta.env.VITE_API_URL as the full API base URL (already ends with /api). Use `${import.meta.env.VITE_API_URL}/your-route` — never `${...VITE_API_URL}/api/...` (that produces /api/api and breaks requests). After fetch: check response.ok; parse JSON defensively; use Array.isArray before .map.",
              "If you use react-router-dom: the preview iframe mounts at `/`. Define an explicit `<Route path=\"/\" element={<Home/>}/>` (or `<Route index .../>`, or a catch-all `<Route path=\"*\".../>`). NEVER hardcode a `basename` prop — the HiveMind preview adds `basename={import.meta.env.BASE_URL}` automatically. Without a `/` route the page renders blank with 'No routes matched location \"/\"'.",
              "Single-page apps don't need react-router-dom at all when there's only one screen — prefer conditional rendering with useState for two-screen demos. Don't pull in routing libraries you don't need.",
            ]
          : [];
      return [
        `You are "${agent.name}", specialization ${agent.specialization}.`,
        mission,
        "",
        "The USER message defines mandatory output rules.",
        "When those rules require STRICT JSON, output exactly one JSON object: plain text starting with { and ending with }.",
        "Do not wrap JSON in markdown code fences. Do not write introductions or summaries outside the JSON.",
        "Each artifacts[].content must hold complete, paste-ready file bodies (use JSON string escaping for newlines and quotes).",
        "Do not put JSX/TSX in *.js files — use .tsx or .jsx; ensure bodies match their extensions (valid TS/HTML).",
        "Never emit double-extension filenames like `index.css.tsx`, `styles.scss.tsx`, or `data.json.tsx`. The bundler will try to parse them as TypeScript and the build aborts. Use one extension that matches the body.",
        "Frontend package.json MUST include every npm package the source code imports. If your CSS uses `@tailwind base/components/utilities` or you ship a `tailwind.config.*`, add `tailwindcss`, `postcss`, `autoprefixer` to dependencies — don't ship Tailwind configs with no matching deps.",
        "Use repo-style paths: frontend/..., backend/..., docs/..., not a single notes/*.md dump unless the user asked for notes only.",
        "Production quality bar: ship multi-file components (never put the whole UI in one file), Tailwind utility classes for layout/spacing/color/responsive design, loading states for async ops, and error boundaries. A bare title + button is a failure.",
        "Match this mission's product and audience in naming, routes, copy — do not reuse unrelated boilerplate demos.",
        ...hiveMindFetch,
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      `You are "${agent.name}", specialization ${agent.specialization}.`,
      mission,
      "",
      "Follow the USER message format exactly (bullets, prose, or JSON as specified there).",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const toolList = toolsFor(agent).join(", ");
  const mission = missionObjective?.trim()
    ? `\nActive mission objective context:\n${missionObjective.slice(0, 4000)}`
    : "";
  const uiHint =
    agent.specialization === "Development"
      ? "\nWhen the mission asks for STRICT JSON with an artifacts array, put full source in each artifact.content (TypeScript, TSX, HTML, etc.). Do not describe code in prose instead of pasting it."
      : agent.specialization === "Design"
        ? "\nWhen asked for structured UI specs in JSON, use concrete artifact paths and paste-ready markdown or CSS snippets in content fields."
        : "";
  return [
    `You are "${agent.name}", a HiveMind Protocol AI agent.`,
    `Specialization: ${agent.specialization}.`,
    `Your advertised model label is "${agent.model}" (routing hint for judges).`,
    `Trust score (off-chain ledger): ${agent.trustScore}/100.`,
    `Typical tools you coordinate with: ${toolList}.${mission}`,
    "",
    "Respond concisely in character as this specialist.",
    "Prefer actionable bullets. Mention delegation when another agent should take over.",
    "Stay grounded — no fabricated transaction hashes.",
    uiHint,
  ]
    .filter(Boolean)
    .join("\n");
}

function mockCompletion(agent: AgentProfile, userMessage: string, missionObjective?: string): string {
  const lower = userMessage.toLowerCase();
  const objHint = missionObjective?.slice(0, 120) ?? "";
  const lines = [
    `[${agent.name} · ${agent.specialization}]`,
    "",
    `Processed request using ${toolsFor(agent)[0]} + ${toolsFor(agent)[1]} (mock runtime — set GROQ_API_KEY for Groq).`,
    "",
  ];
  if (objHint) lines.push(`Mission anchor: ${objHint}${missionObjective!.length > 120 ? "…" : ""}`, "");
  if (lower.includes("delegat")) {
    lines.push(
      "• Recommend routing a follow-up to Coordination for sequencing.",
      "• Parallel Research track can ingest competitor signals while Strategy locks KPI weights.",
    );
  } else if (lower.includes("budget") || lower.includes("sol")) {
    lines.push(
      "• Treasury: stage escrow splits aligned to mission agent roster.",
      "• Suggest 55–65% compute / 15–25% token / remainder escrow buffer for hackathon demos.",
    );
  } else {
    lines.push(
      `• Key takeaway: ${userMessage.slice(0, 160)}${userMessage.length > 160 ? "…" : ""}`,
      "• Next: tighten acceptance criteria and sync vectors into Memory for peer agents.",
    );
  }
  lines.push("", `(Reputation ${agent.reputation.toFixed(2)} · missions logged ${agent.missionsCompleted})`);
  return lines.join("\n");
}

export type AgentInvokeResult = {
  reply: string;
  provider: "groq" | "openai" | "mock";
  model: string;
  /** Present when Groq was attempted but failed (for logs / dev responses only). */
  llmFailure?: string;
};

export type MissionPriority = "low" | "std" | "high" | "crit";

export type InvokeAgentOptions = {
  swarmArtifactStep?: boolean;
  /** Higher max_tokens / user cap; high/crit priority also selects the heavy model. */
  artifactHeavy?: boolean;
  /** Chat invoke: structured JSON `{ assistantReply, fileUpdates[] }` for DB artifact writes. */
  persistArtifactUpdates?: boolean;
  /** Optional block appended after base system prompt (e.g. Vite/API hints). */
  extraSystemBlock?: string;
  /** Mission priority — drives model selection (high/crit → heavy model). */
  priority?: MissionPriority;
  /** Explicit OpenAI model id (ignored when env OPENAI_MODEL_ALL is set). */
  modelOverride?: string;
};

/** Groq small / instant models have tighter context + TPM limits — keep asks conservative. */
function isGroqSmallModel(model: string): boolean {
  return /8b|instant|3\.1-8b|gemma.*2b|gemma.*7b/i.test(model);
}

export function isOpenAiModel(model: string): boolean {
  return /^gpt-|^o[1-9]-|^o\d/i.test(model);
}

/**
 * Known-bad model ids that pass the prefix regex but the OpenAI API rejects.
 * Stale missions/agentModels saved before we corrected the IDs still reference these — the
 * resolver substitutes the env default instead of letting the call 404.
 */
const KNOWN_BAD_MODEL_IDS = new Set<string>([
  "gpt-5.5-long-context",
  "gpt-5-long-context",
]);

function sanitizeModelOverride(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (KNOWN_BAD_MODEL_IDS.has(trimmed)) return undefined;
  return trimmed;
}

/**
 * Reasoning models (o1, o3, o4 series) have special API requirements:
 * - Must use `max_completion_tokens` (not `max_tokens`)
 * - Do NOT support `temperature` parameter
 * - System prompt goes as `developer` role (or user-prepended) on some versions
 */
function isReasoningModel(model: string): boolean {
  return /^o[1-9](-|$)|^o\d(-|$)/i.test(model);
}

/**
 * Models that require `max_completion_tokens` instead of `max_tokens`.
 * Includes all reasoning models AND all gpt-5.x family (incl. gpt-5.5-* ids).
 */
function requiresMaxCompletionTokens(model: string): boolean {
  return isReasoningModel(model) || /^gpt-5/i.test(model);
}

function completionBudget(
  agent: AgentProfile,
  model: string,
  invokeOpts?: InvokeAgentOptions,
): number {
  const roleLarge =
    agent.specialization === "Development" || agent.specialization === "Coordination";
  const roleMedium = agent.specialization === "Design";
  const heavy = Boolean(invokeOpts?.artifactHeavy || invokeOpts?.persistArtifactUpdates);

  // GPT-5 family (incl. gpt-5.5-*): much larger output windows available.
  const isGpt5 = /^gpt-5/i.test(model);
  if (isGpt5) {
    if (roleLarge) return heavy ? 32_000 : 24_000;
    if (roleMedium) return heavy ? 16_000 : 8_000;
    return heavy ? 4_000 : 2_000;
  }
  // OpenAI paid tier: generous limits, no conservative TPM budget required.
  if (isOpenAiModel(model)) {
    if (roleLarge) return heavy ? 16_000 : 12_000;
    if (roleMedium) return heavy ? 8_000 : 4_000;
    return heavy ? 3_000 : 1_500;
  }

  // Groq: stay within free-tier TPM limits (≈6K tokens/min for large models).
  let n = roleLarge ? 6144 : roleMedium ? 4096 : 1024;
  if (heavy) {
    if (roleLarge) n = Math.min(8192, Math.round(n * 1.3));
    else if (roleMedium) n = Math.min(6144, Math.round(n * 1.3));
  }
  if (invokeOpts?.persistArtifactUpdates && roleLarge) {
    n = Math.min(8192, Math.round(n * 1.1));
  }
  if (isGroqSmallModel(model)) {
    const capLarge = heavy ? 4096 : 3072;
    if (roleLarge) n = Math.min(n, capLarge);
    else if (roleMedium) n = Math.min(n, heavy ? 2560 : 2048);
    else n = Math.min(n, 1024);
  }
  return n;
}

function userMessageCharCap(model: string, invokeOpts?: InvokeAgentOptions): number {
  // GPT-5 family (incl. gpt-5.5-*) has large context — allow much larger inputs.
  if (/^gpt-5/i.test(model)) return 64_000;
  // OpenAI: high context limits, no per-minute TPM constraint on paid tier.
  if (isOpenAiModel(model)) return 24_000;
  // Groq: keep input small to stay within TPM limits.
  const heavy = Boolean(invokeOpts?.artifactHeavy || invokeOpts?.persistArtifactUpdates);
  if (isGroqSmallModel(model)) return heavy ? 6_000 : 4_000;
  return heavy ? 10_000 : 7_000;
}

const CHAT_PERSIST_INSTRUCTION = `
--- Artifact persistence mode (mandatory shape) ---
Reply with exactly ONE JSON object (plain text). Do NOT wrap it in markdown code fences.
Shape: {"assistantReply":"markdown or plain summary for the user","fileUpdates":[{"path":"frontend/...","language":"tsx","content":"full file body"}]}
Rules:
- assistantReply is required (can be brief). Explain what you changed if fileUpdates is non-empty.
- fileUpdates may be [] if you only advise. Each path must stay under frontend/, backend/, docs/, design/, notes/ (no "..").
- content must be the complete replaced file contents for that path when including it.
- For HiveMind preview, import.meta.env.VITE_API_URL already ends with /api — never use \${...VITE_API_URL}/api/...
`.trim();

export async function invokeAgentCompletion(
  cfg: AppConfig,
  agent: AgentProfile,
  userMessage: string,
  missionObjective?: string,
  invokeOpts?: InvokeAgentOptions,
): Promise<AgentInvokeResult> {
  let system = buildSystemPrompt(agent, missionObjective, {
    swarmArtifactStep: invokeOpts?.swarmArtifactStep,
  });
  if (invokeOpts?.persistArtifactUpdates) {
    system += `\n\n${CHAT_PERSIST_INSTRUCTION}`;
  }
  if (invokeOpts?.extraSystemBlock?.trim()) {
    system += `\n\n${invokeOpts.extraSystemBlock.trim()}`;
  }
  const swarmJsonStep =
    Boolean(invokeOpts?.swarmArtifactStep) && JSON_ARTIFACT_SPECIALIZATIONS.has(agent.specialization);
  const lowTempStructured = swarmJsonStep || Boolean(invokeOpts?.persistArtifactUpdates);
  const priority = invokeOpts?.priority ?? "std";
  // High/critical missions use the heavy model; artifactHeavy flag also promotes to heavy.
  const useOpenAiHeavy =
    priority === "high" || priority === "crit" ||
    (Boolean(invokeOpts?.artifactHeavy) && (swarmJsonStep || Boolean(invokeOpts?.persistArtifactUpdates)));
  const groqKey = cfg.GROQ_API_KEY;
  const apiBase = cfg.GROQ_API_BASE ?? "https://api.groq.com/openai/v1";
  const primaryModel = cfg.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const fallbackModel = cfg.GROQ_FALLBACK_MODEL ?? "llama-3.1-8b-instant";
  const backoffMs = cfg.GROQ_429_BACKOFF_MS ?? 12_000;
  const openAiKey = cfg.OPENAI_API_KEY;
  const openAiAll = cfg.OPENAI_MODEL_ALL?.trim();
  const openAiModel = cfg.OPENAI_MODEL ?? "gpt-4o-mini";
  const openAiHeavy = cfg.OPENAI_MODEL_HEAVY ?? "gpt-4.1";
  // Critical priority gets the strongest available model when no per-agent override is set.
  const openAiCrit = cfg.OPENAI_MODEL_CRIT ?? "gpt-5.1";

  /**
   * Resolve OpenAI model id:
   * - OPENAI_MODEL_ALL (env): forces one model for every agent / priority (overrides mission agentModels).
   * - invokeOpts.modelOverride: per-call when ALL is not set (e.g. mission agentModels from swarm).
   * - Else: crit > heavy > std from env.
   */
  const sanitizedOverride = sanitizeModelOverride(invokeOpts?.modelOverride);
  const sanitizedAll = sanitizeModelOverride(openAiAll);
  const resolvedOpenAiModel =
    sanitizedAll && isOpenAiModel(sanitizedAll)
      ? sanitizedAll
      : sanitizedOverride && isOpenAiModel(sanitizedOverride)
        ? sanitizedOverride
        : priority === "crit"
          ? openAiCrit
          : useOpenAiHeavy
            ? openAiHeavy
            : openAiModel;

  const callOpenAi = async (pickedModel: string): Promise<AgentInvokeResult> => {
    const client = new OpenAI({ apiKey: openAiKey });
    const maxTok = completionBudget(agent, pickedModel, invokeOpts);
    const userCap = userMessageCharCap(pickedModel, invokeOpts);
    const reasoning = isReasoningModel(pickedModel);
    const useCompletionTokens = requiresMaxCompletionTokens(pickedModel);

    // Reasoning models (o1/o3/o4) don't support system messages or temperature.
    // Prepend system instructions into the user turn instead.
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = reasoning
      ? [{ role: "user", content: `${system}\n\n---\n\n${userMessage.slice(0, userCap)}` }]
      : [
          { role: "system", content: system },
          { role: "user", content: userMessage.slice(0, userCap) },
        ];

    // gpt-5.x burns ~30% of max_completion_tokens on hidden reasoning by default,
    // starving the actual output budget. Probed empirically: with reasoning_effort:"none"
    // a 100+ line snake game returns in 29s vs 110s with the default; 0 reasoning tokens
    // vs ~2.5k. Codegen roles → none (full budget for code). Strategy/Research/etc → low.
    // Reasoning models (o1/o3/o4) don't accept this parameter at all.
    const reasoningEffort: "none" | "low" | undefined = !/^gpt-5/i.test(pickedModel)
      ? undefined
      : (agent.specialization === "Development" || agent.specialization === "Coordination" || agent.specialization === "Design")
        ? "none"
        : "low";

    const baseParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: pickedModel,
      messages,
      ...(useCompletionTokens
        ? { max_completion_tokens: maxTok }
        : { max_tokens: maxTok }),
      ...(reasoning ? {} : { temperature: lowTempStructured ? 0.2 : 0.35 }),
    };
    // `reasoning_effort` is a real OpenAI param for gpt-5.x but isn't surfaced in this
    // SDK version's typings — attach via cast so the field still flows through.
    const params = reasoningEffort
      ? ({ ...baseParams, reasoning_effort: reasoningEffort } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming)
      : baseParams;
    const resp = await client.chat.completions.create(params);
    const choice = resp.choices?.[0];
    const finish = choice?.finish_reason;
    const reply = choice?.message?.content?.trim() ?? "(empty model response)";
    // Truncated by token budget: surface to caller so the repair loop / chat UX
    // can react ("response was cut off — agent will continue"). Avoid the silent
    // mid-stream cut-off that produced files like `import Snake from './` last run.
    if (finish === "length") {
      const usage = (resp as { usage?: { completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } } }).usage;
      const c = usage?.completion_tokens ?? 0;
      const r = usage?.completion_tokens_details?.reasoning_tokens ?? 0;
      console.warn(
        `[hivemind] OpenAI truncated reply (finish_reason=length) model=${pickedModel} budget=${maxTok} completion_tokens=${c} reasoning_tokens=${r} role=${agent.specialization}`,
      );
      return {
        reply,
        provider: "openai",
        model: pickedModel,
        llmFailure: `truncated_at_${maxTok}_tokens`,
      };
    }
    return { reply, provider: "openai", model: pickedModel };
  };

  /** OpenAI error indicating the model id doesn't exist on this account / API version. */
  const isUnknownModelError = (msg: string): boolean => {
    const m = msg.toLowerCase();
    return (
      m.includes("model_not_found") ||
      m.includes("does not exist") ||
      m.includes("the model `") ||
      m.includes("invalid model") ||
      m.includes("unknown model")
    );
  };

  const tryOpenAi = async (reasonPrefix: string): Promise<AgentInvokeResult | null> => {
    if (!openAiKey) return null;
    try {
      return await callOpenAi(resolvedOpenAiModel);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // If the chosen model id doesn't exist (e.g. stale `agentModels` override pointing at
      // a retired id), retry once with the env-default model so we don't silently fall
      // through to Groq/mock.
      if (isUnknownModelError(msg) && resolvedOpenAiModel !== openAiModel) {
        console.warn(
          `[hivemind] OpenAI rejected model ${resolvedOpenAiModel} (${reasonPrefix}); retrying with env default ${openAiModel}.`,
        );
        try {
          return await callOpenAi(openAiModel);
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          console.warn(`[hivemind] OpenAI fallback to ${openAiModel} also failed:`, msg2);
          return null;
        }
      }
      console.warn(`[hivemind] OpenAI call failed (${reasonPrefix}):`, msg);
      return null;
    }
  };

  // PRIMARY: OpenAI — paid tier, no TPM constraints, priority-aware model selection.
  if (openAiKey) {
    const oi = await tryOpenAi("primary");
    if (oi) return oi;
  }

  // FALLBACK: Groq — free-tier rate limits apply; retries with shrink + smaller model on TPM errors.
  if (groqKey) {
    try {
      const url = `${apiBase.replace(/\/$/, "")}/chat/completions`;
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const callOnce = async (model: string, maxTokens: number, userCharCap: number): Promise<string> => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: userMessage.slice(0, userCharCap) },
            ],
            max_tokens: maxTokens,
            temperature: lowTempStructured ? 0.2 : 0.35,
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`groq_http_${res.status}: ${errText.slice(0, 400)}`);
        }
        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const reply = json.choices?.[0]?.message?.content?.trim() ?? "";
        return reply || "(empty model response)";
      };

      /**
       * Retries on 413/429 TPM errors by shrinking BOTH the output budget (max_tokens)
       * AND the input message length. Groq TPM = input + output tokens combined, so
       * reducing only max_tokens doesn't fix rate-limit errors caused by large inputs.
       */
      const callWithShrink = async (model: string): Promise<string> => {
        let maxTok = completionBudget(agent, model, invokeOpts);
        let userCap = userMessageCharCap(model, invokeOpts);
        let lastErr: unknown;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            return await callOnce(model, maxTok, userCap);
          } catch (e) {
            lastErr = e;
            const msg = e instanceof Error ? e.message : String(e);
            const tooLarge =
              msg.startsWith("groq_http_413") ||
              /too large|payload too large|tokens per minute|TPM/i.test(msg);
            if (!tooLarge) throw e;
            // Shrink both output budget AND input cap so total TPM usage drops.
            maxTok = Math.max(512, Math.floor(maxTok * 0.55));
            userCap = Math.max(1200, Math.floor(userCap * 0.55));
            console.warn(
              `[hivemind] Groq TPM/size limit hit for ${model}; retry ${attempt + 1}/3 with max_tokens=${maxTok}, user_chars=${userCap}`,
            );
          }
        }
        throw lastErr;
      };

      try {
        const reply = await callWithShrink(primaryModel);
        return { reply, provider: "groq", model: primaryModel };
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        if (reason.startsWith("groq_http_429") && fallbackModel && fallbackModel !== primaryModel) {
          console.warn("[hivemind] Groq rate-limited; retrying with fallback model:", fallbackModel);
          try {
            const reply = await callWithShrink(fallbackModel);
            return { reply, provider: "groq", model: fallbackModel };
          } catch (e2) {
            const reason2 = e2 instanceof Error ? e2.message : String(e2);
            if (reason2.startsWith("groq_http_429") && reason2.toLowerCase().includes("tokens per minute")) {
              console.warn("[hivemind] Fallback TPM rate limit; backing off then retrying once.");
              await sleep(backoffMs);
              try {
                const reply = await callWithShrink(fallbackModel);
                return { reply, provider: "groq", model: fallbackModel };
              } catch { /* fall through to mock */ }
            }
          }
        }
        throw e;
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.warn("[hivemind] Groq chat completion failed:", reason);
      return {
        reply:
          mockCompletion(agent, userMessage, missionObjective) +
          "\n\n(note: Groq call failed — showing mock fallback)",
        provider: "mock",
        model: "mock-fallback",
        llmFailure: reason,
      };
    }
  }

  return {
    reply: mockCompletion(agent, userMessage, missionObjective),
    provider: "mock",
    model: "hivemind-mock-v1",
  };
}
