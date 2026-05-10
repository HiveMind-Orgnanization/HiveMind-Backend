import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

/** Load `.env` from this package root — not `process.cwd()` (breaks when starting the API from a parent folder). */
const backendEnvPath = path.resolve(__dirname, "../..", ".env");
dotenv.config({ path: backendEnvPath });

function normalizeOptionalApiKey(val: unknown): string | undefined {
  if (val == null) return undefined;
  let s = String(val).replace(/^\uFEFF/, "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.length > 0 ? s : undefined;
}

function trimOpt(val: unknown): string | undefined {
  if (val == null || val === "") return undefined;
  const s = String(val).trim().replace(/\/$/, "");
  return s.length > 0 ? s : undefined;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8787),
  HOST: z.string().default("0.0.0.0"),
  /** Pino/Fastify log level. Use `warn` to hide request logs. */
  LOG_LEVEL: z
    .preprocess((v) => {
      const s = String(v ?? "").trim().toLowerCase();
      return s.length === 0 ? undefined : s;
    }, z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("warn")),
  /** Emit periodic fake agent.activity heartbeats (demo UI only). */
  DEMO_PULSE: z
    .preprocess((v) => {
      const s = String(v ?? "").trim().toLowerCase();
      return s.length === 0 ? undefined : s;
    }, z.enum(["true", "false"]).default("false"))
    .transform((v) => v === "true"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("*"),
  SOLANA_RPC_URL: z.string().url().optional(),
  /** When non-empty, missions/agents/tasks/memory/auth persist here (postgresql://…). */
  DATABASE_URL: z.string().optional(),
  /**
   * Groq Cloud API key — chat completions via OpenAI-compatible API.
   * Falls back to XAI_API_KEY only so older `.env` lines keep loading until renamed.
   */
  GROQ_API_KEY: z.preprocess(
    (_val) =>
      normalizeOptionalApiKey(process.env.GROQ_API_KEY ?? process.env.XAI_API_KEY),
    z.string().optional(),
  ),
  /** Groq model id — https://console.groq.com/docs/models */
  GROQ_MODEL: z.preprocess(trimOpt, z.string().optional()),
  /** Optional fallback model (used on 429 rate limit). Default llama-3.1-8b-instant. */
  GROQ_FALLBACK_MODEL: z.preprocess(trimOpt, z.string().optional()),
  /** Backoff before retrying a 429 TPM on fallback model (ms). */
  GROQ_429_BACKOFF_MS: z.coerce.number().optional(),
  /** Default https://api.groq.com/openai/v1 */
  GROQ_API_BASE: z.preprocess(trimOpt, z.string().optional()),

  /**
   * OpenAI API key (optional fallback when Groq is rate-limited / oversized).
   * https://platform.openai.com/api-keys
   */
  OPENAI_API_KEY: z.preprocess((_v) => normalizeOptionalApiKey(process.env.OPENAI_API_KEY), z.string().optional()),
  /** OpenAI model id (e.g. gpt-4.1-mini, gpt-4o-mini). */
  OPENAI_MODEL: z.preprocess(trimOpt, z.string().optional()),
  /**
   * Preferred OpenAI model for heavy swarm codegen (Development / Coordination repair).
   * Defaults to gpt-4.1 when unset.
   */
  OPENAI_MODEL_HEAVY: z.preprocess(trimOpt, z.string().optional()),
  /**
   * OpenAI model used when mission priority = "crit" and no per-agent override is set.
   * Defaults to gpt-5.1 when unset.
   */
  OPENAI_MODEL_CRIT: z.preprocess(trimOpt, z.string().optional()),
  /** Max automated build+verify repair rounds after swarm (default 5). */
  SWARM_BUILD_REPAIR_MAX_ROUNDS: z.coerce.number().min(1).max(10).optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    console.error(flat);
    const detail = Object.entries(flat)
      .filter(([, msgs]) => msgs && msgs.length > 0)
      .map(([key, msgs]) => `${key}: ${msgs!.join("; ")}`)
      .join(" · ");
    throw new Error(
      detail
        ? `Invalid environment configuration (${detail})`
        : "Invalid environment configuration",
    );
  }
  const cfg = parsed.data;
  if (cfg.NODE_ENV !== "test") {
    if (cfg.GROQ_API_KEY) {
      const model = cfg.GROQ_MODEL ?? "llama-3.3-70b-versatile";
      const legacyXai = Boolean(process.env.XAI_API_KEY && !process.env.GROQ_API_KEY);
      console.log(
        `[hivemind] Groq configured (key length ${cfg.GROQ_API_KEY.length}, model ${model}${legacyXai ? "; loaded from XAI_API_KEY — set GROQ_API_KEY" : ""}). Env: ${backendEnvPath}`,
      );
    } else {
      console.log(`[hivemind] GROQ_API_KEY missing — invoke uses mock. Env path tried: ${backendEnvPath}`);
    }
    if (cfg.OPENAI_API_KEY) {
      const m = cfg.OPENAI_MODEL ?? "gpt-4o-mini";
      const heavy = cfg.OPENAI_MODEL_HEAVY ?? "gpt-4.1";
      const crit = cfg.OPENAI_MODEL_CRIT ?? "gpt-5.1";
      console.log(`[hivemind] OpenAI configured (key ${cfg.OPENAI_API_KEY.length}ch · std:${m} · high:${heavy} · crit:${crit}).`);
    }
  }
  return cfg;
}
