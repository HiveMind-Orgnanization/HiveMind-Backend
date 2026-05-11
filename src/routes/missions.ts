import type { FastifyInstance } from "fastify";
import AdmZip from "adm-zip";
import { z } from "zod";
import type { AppConfig } from "../config/env";
import type { RealtimeHub } from "../services/realtime";
import { hivemindStore } from "../services/store";
import { requireWallet } from "../hooks/auth";
import { computeMissionLiveMetrics } from "../services/mission-live-metrics";
import { detectAgentSpecialization } from "../services/agent-detect";
import { invokeAgentCompletion, type MissionPriority } from "../services/agent-runtime";
import { previewManager, sanitizeViteApiUrlDoubleApi } from "../services/preview-manager";
import {
  buildDesignRagUserBlock,
  isUiPolishMission,
  verifyTailwindStack,
  verifyUiContentHeuristics,
  verifyViteApiUrlAntipattern,
  verifyStaleViteToolchain,
  verifyReactRouterHasHomeRoute,
  verifyNoHardcodedBasename,
} from "../services/swarm-quality";
import { appendSwarmQualityLog } from "../services/swarm-quality-log";
import type { Mission } from "../types/domain";

// ── Swarm-run async job tracking ─────────────────────────────────────────────
type SwarmJobStatus = "running" | "done" | "failed";
type SwarmJob = {
  status: SwarmJobStatus;
  missionId: string;
  wallet: string;
  data?: unknown;
  error?: string;
  startedAt: number;
  progress?: {
    currentRole: string | null;
    completedRoles: string[];
    partialResults: Array<{ role: string; agentName: string; replySnippet: string; provider: string; model: string }>;
  };
};
const swarmJobs = new Map<string, SwarmJob>();
// Prune completed jobs older than 2 hours so the Map doesn't grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [k, v] of swarmJobs) if (v.startedAt < cutoff) swarmJobs.delete(k);
}, 10 * 60 * 1000).unref();

/** Background preview-build job state (npm install + vite build can take 1-5 min on EB). */
type PreviewJob = {
  status: "running" | "done" | "failed";
  wallet: string;
  missionId: string;
  startedAt: number;
  sessionId?: string;
  url?: string;
  error?: string;
};
const previewJobs = new Map<string, PreviewJob>();
setInterval(() => {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [k, v] of previewJobs) if (v.startedAt < cutoff && v.status !== "running") previewJobs.delete(k);
}, 5 * 60_000).unref();

const budgetAllocationSchema = z.object({
  agentCompute: z.number().min(0).max(1),
  tokenUsage: z.number().min(0).max(1),
  escrowReserve: z.number().min(0).max(1),
  settlementBuffer: z.number().min(0).max(1),
});

/** Route param is user-controlled; escape before building RegExp from it. */
function escapeRegExpToken(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Upstream may omit Content-Type; module scripts require JS MIME or Chrome blocks with empty type. */
function guessPreviewStaticMime(pathOnly: string): string {
  const norm = pathOnly.split("?")[0] || "/";
  if (norm === "/" || norm.endsWith("/")) return "text/html; charset=utf-8";
  const base = norm.split("/").pop()?.toLowerCase() ?? "";
  if (base.endsWith(".js") || base.endsWith(".mjs") || base.endsWith(".cjs")) {
    return "text/javascript; charset=utf-8";
  }
  if (base.endsWith(".css")) return "text/css; charset=utf-8";
  if (base.endsWith(".html")) return "text/html; charset=utf-8";
  if (base.endsWith(".json")) return "application/json; charset=utf-8";
  if (base.endsWith(".svg")) return "image/svg+xml";
  if (base.endsWith(".ico")) return "image/x-icon";
  if (base.endsWith(".png")) return "image/png";
  if (base.endsWith(".jpg") || base.endsWith(".jpeg")) return "image/jpeg";
  if (base.endsWith(".webp")) return "image/webp";
  if (base.endsWith(".wasm")) return "application/wasm";
  if (base.endsWith(".map")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

const missionConfigSchema = z.object({
  priorityKey: z.string(),
  deliverables: z.array(z.string()),
  successMetrics: z.array(z.object({ label: z.string(), target: z.string() })),
  deadlineIso: z.string().nullable(),
  delegationPct: z.number().min(0).max(100),
  executionSpeedPct: z.number().min(0).max(100),
  collaborationPct: z.number().min(0).max(100),
  autoApproveSubtasks: z.boolean(),
  sharedCrossAgentMemory: z.boolean(),
  autoOnChainSettlement: z.boolean(),
  budgetAllocation: budgetAllocationSchema,
  /** Per-agent model overrides (agent name → OpenAI model id). */
  agentModels: z.record(z.string()).optional(),
});

const createMission = z.object({
  title: z.string().min(1),
  objective: z.string().min(1),
  priority: z.string().default("medium"),
  status: z.enum(["active", "queued", "completed"]).default("active"),
  agents: z.array(z.string()).default([]),
  budget: z.number().nonnegative().default(0),
  cost: z.number().nonnegative().default(0),
  progress: z.number().min(0).max(100).default(0),
  eta: z.string().default("—"),
  confidence: z.number().min(0).max(100).default(80),
  config: missionConfigSchema.optional(),
});

const patchMission = createMission.partial();

const autoInvokeBody = z
  .object({
    title: z.string().min(1).optional(),
    objective: z.string().min(1).optional(),
  })
  .optional();

const workspaceSnapshotPut = z.object({
  v: z.literal(1),
  messages: z.array(
    z.object({
      id: z.number(),
      agent: z.string(),
      color: z.string(),
      text: z.string(),
      state: z.enum(["thinking", "delegating", "executing", "approved"]).optional(),
      ts: z.string(),
    }),
  ),
  logLines: z.array(z.object({ ts: z.number(), agent: z.string(), message: z.string() })),
  timelineEvents: z.array(z.object({ ts: z.number(), l: z.string(), c: z.string() })),
  selectedAgent: z.string(),
  updatedAt: z.number().optional(),
});

const createBriefBody = z
  .object({
    /** Optional override; when mission is not persisted, send these. */
    title: z.string().min(1).optional(),
    objective: z.string().min(1).optional(),
    /** Force re-generate even if one exists. */
    force: z.boolean().optional(),
  })
  .optional();

function briefPrompt(title: string, objective: string): string {
  return [
    "You are generating the Mission Brief for a multi-agent autonomous build.",
    "Turn the user's short objective into a detailed, unambiguous specification.",
    "",
    "Return STRICT JSON only (no markdown) with this shape:",
    "{",
    '  "summary": string,',
    '  "users": string[],',
    '  "problem": string,',
    '  "goals": string[],',
    '  "nonGoals": string[],',
    '  "features": { "mvp": string[], "v1": string[] },',
    '  "pages": Array<{ "name": string, "path": string, "purpose": string }>,',
    '  "api": Array<{ "method": string, "path": string, "purpose": string }>,',
    '  "dataModel": Array<{ "entity": string, "fields": string[] }>,',
    '  "techStack": { "frontend": string, "backend": string, "db": string, "auth": string },',
    '  "acceptanceCriteria": string[],',
    '  "deliverables": Array<{ "pathHint": string, "description": string }>',
    "}",
    "",
    `Mission title: ${title}`,
    `Mission objective: ${objective}`,
  ].join("\n");
}

/** Collect likely JSON substrings: full trim, fenced ```json blocks, outermost `{...}` slice. */
function jsonStringCandidates(raw: string): string[] {
  const t = raw.trim();
  const out: string[] = [];
  const push = (s: string) => {
    const x = s.trim();
    if (x.length > 0) out.push(x);
  };
  push(t);

  const fence = /```(?:json)?\s*\r?\n?([\s\S]*?)```/.exec(t);
  if (fence?.[1]) push(fence[1]);

  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) push(t.slice(start, end + 1));

  return [...new Set(out)];
}

function safeJsonParse(raw: string): unknown | null {
  for (const c of jsonStringCandidates(raw)) {
    try {
      return JSON.parse(c);
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/**
 * LLMs hit token limits mid-JSON, producing truncated output like:
 *   {"summary":"...","artifacts":[{"path":"frontend/App.tsx","content":"import React...
 * Standard JSON.parse fails. This function salvages any complete artifact objects
 * by scanning for {"path":...,"content":...} patterns before the truncation point.
 */
function extractPartialArtifacts(
  raw: string,
): Array<{ path: string; language?: string; content: string; kind: "file" }> | null {
  const t = raw.trim();
  // Only attempt if the response looks like it started as our expected JSON shape.
  const startsLikeJson = t.startsWith("{") || /```(?:json)?/.test(t.slice(0, 20));
  if (!startsLikeJson) return null;

  const results: Array<{ path: string; language?: string; content: string; kind: "file" }> = [];
  // Match individual artifact objects: capture path, optional language, content up to next path key or end.
  // We accept truncated content — better to have partial code than a notes dump.
  const artifactPattern = /"path"\s*:\s*"([^"]+)"[\s\S]*?"content"\s*:\s*"((?:[^"\\]|\\[\s\S])*)/g;
  const langPattern = /"language"\s*:\s*"([^"]+)"/;

  let m: RegExpExecArray | null;
  while ((m = artifactPattern.exec(t)) !== null) {
    const path = m[1];
    const rawContent = m[2];
    if (!path || rawContent === undefined) continue;
    // Only accept paths under allowed prefixes (same as ALLOWED_PREFIX in agent-invoke-artifacts).
    if (!/^(frontend\/|backend\/|server\/|api\/|docs\/|design\/|readme)/i.test(path)) continue;

    // Unescape JSON string sequences in the captured content.
    let content = "";
    try {
      content = JSON.parse(`"${rawContent}"`);
    } catch {
      // If unescape fails use raw with basic replacements.
      content = rawContent.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }

    // Detect language from nearby "language" key in the ~300 chars before path.
    const nearbySlice = t.slice(Math.max(0, m.index - 50), m.index + 300);
    const langM = langPattern.exec(nearbySlice);
    const language = langM?.[1];

    results.push({ path, language, content, kind: "file" });
  }

  return results.length > 0 ? results : null;
}

/** Prevent zip-slip and odd paths; returns POSIX-style path under the archive root or null if unsafe. */
function safeZipEntryPath(pathStr: string): string | null {
  const normalized = pathStr.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter((s) => s.length > 0 && s !== ".");
  if (segments.some((s) => s === "..")) return null;
  if (segments.length === 0) return null;
  return segments.join("/");
}

/** Build an ASCII file tree from artifact paths. */
function buildArtifactTreeText(paths: string[]): string {
  type Node = { name: string; children: Map<string, Node>; isFile: boolean };
  const root: Node = { name: "", children: new Map(), isFile: false };
  for (const p of [...new Set(paths)].sort()) {
    const segs = p.replace(/\\/g, "/").replace(/^\/+/, "").split("/").filter(Boolean);
    if (segs.length === 0) continue;
    let cur = root;
    segs.forEach((seg, i) => {
      const isFile = i === segs.length - 1;
      let child = cur.children.get(seg);
      if (!child) {
        child = { name: seg, children: new Map(), isFile };
        cur.children.set(seg, child);
      } else if (isFile) {
        child.isFile = true;
      }
      cur = child;
    });
  }
  const out: string[] = [];
  const walk = (node: Node, prefix: string) => {
    const entries = [...node.children.values()].sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    entries.forEach((child, i) => {
      const last = i === entries.length - 1;
      out.push(`${prefix}${last ? "└─ " : "├─ "}${child.isFile ? child.name : `${child.name}/`}`);
      if (!child.isFile) walk(child, `${prefix}${last ? "   " : "│  "}`);
    });
  };
  walk(root, "");
  return out.join("\n");
}

export type SwarmVerificationReport = {
  ok: boolean;
  summary: string;
  issues: string[];
  coverage: {
    frontend: boolean;
    backend: boolean;
    readme: boolean;
    docs: boolean;
    notesOnly: boolean;
  };
  artifactPathCount: number;
};

/** Missions that read as a public marketing / landing page (stricter UI checks + prompts). */
function isLandingStyleMission(title: string, objective: string): boolean {
  const t = `${title} ${objective}`.toLowerCase();
  if (
    /\blanding page\b|\blanding site\b|\bhomepage\b|\bhome page\b|\bmarketing site\b|\bmarketing page\b|\bmarketing website\b|\bsplash page\b/.test(t)
  ) {
    return true;
  }
  if (
    (t.includes("production ready") || t.includes("production-ready")) &&
    /\b(page|site|landing|homepage|frontend|website|web app)\b/.test(t)
  ) {
    return true;
  }
  return false;
}

/** Whether the brief implies a server/API layer (otherwise frontend depth beats a boilerplate backend). */
function missionRequiresBackend(title: string, objective: string): boolean {
  const t = `${title} ${objective}`.toLowerCase();
  if (
    /\b(api|backend|rest\s*api|graphql|server|database|db|postgres|mysql|mongo|prisma|auth|jwt|oauth|login|signup|webhook|microservice|on[- ]?chain|smart contract|solidity|evm|wallet\s*connect|rpc|indexer|websocket)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (isLandingStyleMission(title, objective)) return false;
  return true;
}

/** Appended for Design / Development / Coordination when the mission looks like a landing page. */
function buildLandingQualitySupplement(title: string, objective: string): string {
  if (!isLandingStyleMission(title, objective)) return "";
  return [
    "",
    "## Quality bar: public landing / marketing page",
    "Deliver a visually complete experience, not a bare title + one default button.",
    "- Layout: top navigation (logo + links), hero (headline, subcopy, primary CTA), at least two more sections (e.g. features, stats, trust/security), and a footer (links + copyright).",
    "- Styling: prefer Tailwind in `frontend/` (tailwind.config, postcss), OR a global stylesheet such as `frontend/src/index.css` imported from `frontend/src/main.tsx` — with typography, spacing, palette, and responsive breakpoints.",
    "- Use a web font or a clear hierarchy (e.g. Google Fonts in CSS) unless the brief forbids external assets.",
    "- Split UI into named files under `frontend/src/components/` or `frontend/src/pages/` (Navbar, Hero, Feature sections, Footer), not only a minimal App.tsx.",
    "- DeFi/crypto-style briefs: default to a polished dark or strong high-contrast theme unless the brief says otherwise.",
    "",
    "Design role: encode the same sections, tokens (colors/type/spacing), and component list in `design/ui-spec.md`.",
  ].join("\n");
}

function verifyLandingPolish(paths: string[], title: string, objective: string): string[] {
  if (!isLandingStyleMission(title, objective)) return [];
  const lower = paths.map((p) => p.toLowerCase());
  const issues: string[] = [];
  const hasCss = lower.some((p) => p.endsWith(".css") && p.startsWith("frontend/"));
  const hasTailwindConfig = lower.some((p) => p.includes("tailwind.config"));
  if (!hasCss && !hasTailwindConfig) {
    issues.push(
      "Landing-style mission: ship real styling — add `frontend/**/*.css` imported from the entry, or Tailwind (`tailwind.config.*` + postcss) and use utilities in JSX.",
    );
  }
  const uiFiles = lower.filter((p) =>
    /^frontend\/src\/(components|pages)\/[^/]+\.(tsx|jsx)$/.test(p),
  );
  if (uiFiles.length < 2) {
    issues.push(
      "Landing-style mission: split the UI into multiple components/pages under `frontend/src/components/` or `frontend/src/pages/` (nav, hero, sections, footer), not a flat unstyled shell.",
    );
  }
  return issues;
}

/**
 * Extract the most actionable snippet from a Vite/Rollup/tsc build log.
 * Returns: { errorType, message, files, surgicalPrompt }
 */
function parseBuildLog(log: string): {
  errorType: "missing_package" | "missing_file" | "syntax" | "type" | "unknown";
  errorBlocks: string[];
  missingPackages: string[];
  filesWithErrors: string[];
  surgicalPrompt: string;
} {
  const missingPackages: string[] = [];
  const filesWithErrors: string[] = [];
  const errorBlocks: string[] = [];

  // Extract Vite/Rollup ERROR blocks (between [ERROR] and blank line or next [ERROR])
  const errorBlockRe = /\[(?:ERROR|error)\][^\n]*([\s\S]*?)(?=\[ERROR\]|\[error\]|✗ \[|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = errorBlockRe.exec(log)) !== null) {
    const block = m[0].slice(0, 800).trim();
    if (block) errorBlocks.push(block);
  }
  // Also grab ✗ blocks
  const viteCrossRe = /✗[^\n]*([\s\S]*?)(?=✗ |$)/g;
  while ((m = viteCrossRe.exec(log)) !== null) {
    const block = m[0].slice(0, 800).trim();
    if (block && !errorBlocks.includes(block)) errorBlocks.push(block);
  }
  if (errorBlocks.length === 0) {
    // Fallback: grab lines with "error" keyword
    const lines = log.split("\n").filter((l) => /\berror\b/i.test(l)).slice(0, 10);
    if (lines.length) errorBlocks.push(lines.join("\n"));
  }

  // Extract missing packages
  const pkgPatterns = [
    /Failed to resolve import ["']([^"'.][^"']*)["']/gi,
    /Could not resolve ["']([^"'.][^"']*)["']/gi,
    /Cannot find module ["']([^"'.][^"']*)["']/gi,
  ];
  for (const pat of pkgPatterns) {
    let pm: RegExpExecArray | null;
    while ((pm = pat.exec(log)) !== null) {
      const raw = pm[1]!;
      if (raw.startsWith(".") || raw.startsWith("/")) continue;
      const base = raw.startsWith("@") ? raw.split("/").slice(0, 2).join("/") : raw.split("/")[0]!;
      if (base && !missingPackages.includes(base)) missingPackages.push(base);
    }
  }

  // Extract source files mentioned in errors
  const fileRe = /\b((?:frontend|src)\/[^\s:'"]+\.(?:tsx?|jsx?))/gi;
  while ((m = fileRe.exec(log)) !== null) {
    const f = m[1]!;
    if (!filesWithErrors.includes(f)) filesWithErrors.push(f);
  }

  let errorType: "missing_package" | "missing_file" | "syntax" | "type" | "unknown" = "unknown";
  if (missingPackages.length > 0) errorType = "missing_package";
  else if (/Cannot find file|does not exist|not found/i.test(log)) errorType = "missing_file";
  else if (/Unexpected token|SyntaxError|Parsing error/i.test(log)) errorType = "syntax";
  else if (/TS\d{4}|type error|is not assignable/i.test(log)) errorType = "type";

  const surgicalPrompt = [
    "## BUILD ERROR — FIX REQUIRED",
    `Error type: ${errorType}`,
    "",
    errorBlocks.length > 0
      ? `### Exact error output\n${errorBlocks.slice(0, 3).join("\n\n").slice(0, 2000)}`
      : `### Build log (last 2000 chars)\n${log.slice(-2000)}`,
    "",
    missingPackages.length > 0
      ? `### Missing npm packages — add these to frontend/package.json dependencies:\n${missingPackages.map((p) => `  - "${p}": "latest"`).join("\n")}`
      : "",
    filesWithErrors.length > 0
      ? `### Files with errors — ONLY regenerate these files:\n${filesWithErrors.map((f) => `  - ${f}`).join("\n")}`
      : "",
    "",
    "## REPAIR INSTRUCTIONS",
    "1. Generate ONLY the files listed above (or frontend/package.json if packages are missing).",
    "2. Do NOT regenerate files that are already working — only touch what the error references.",
    "3. If adding a package to package.json, list EVERY dependency the code actually imports.",
    "4. Fix the root cause — do not just add a workaround.",
    "5. After your fix, the `vite build` command must succeed with exit code 0.",
    "Return STRICT JSON: { \"summary\": string, \"artifacts\": [{\"path\", \"language\", \"content\", \"kind\": \"file\"}] }",
    "Include ONLY the files that changed. Empty artifacts array = no repair attempt.",
  ].filter(Boolean).join("\n");

  return { errorType, errorBlocks, missingPackages, filesWithErrors, surgicalPrompt };
}

/**
 * Deterministic verifier: confirms the swarm actually produced runnable deliverables
 * (frontend + backend + README) instead of just markdown notes. No extra LLM call.
 */
function verifyArtifactCoverage(
  paths: string[],
  opts?: { title?: string; objective?: string },
): SwarmVerificationReport {
  const lower = paths.map((p) => p.toLowerCase());
  const has = (pred: (p: string) => boolean) => lower.some(pred);
  const frontend = has((p) => p.startsWith("frontend/") || p === "index.html" || p.endsWith("/index.html"));
  const backend = has((p) => p.startsWith("backend/") || p.startsWith("server/") || p.startsWith("api/"));
  const readme = has((p) => p === "readme.md" || p.endsWith("/readme.md"));
  const docs = has((p) => p.startsWith("docs/") || p.startsWith("design/"));
  const notesOnly = paths.length > 0 && paths.every((p) => p.toLowerCase().startsWith("notes/"));

  const issues: string[] = [];
  if (paths.length === 0) issues.push("No artifacts were produced.");
  if (notesOnly) issues.push("Only notes/*.md were produced; no runnable code shipped.");
  const requireBackend =
    opts?.title !== undefined && opts?.objective !== undefined
      ? missionRequiresBackend(opts.title, opts.objective)
      : true;
  if (!frontend && !notesOnly) issues.push("No frontend/* artifacts found.");
  if (!backend && !notesOnly && requireBackend) issues.push("No backend/* artifacts found.");
  if (!readme && !notesOnly) issues.push("No README.md at repo root.");
  if (opts?.title !== undefined && opts?.objective !== undefined) {
    issues.push(...verifyLandingPolish(paths, opts.title, opts.objective));
  }

  const ok = issues.length === 0;
  const summary = ok
    ? `Verified · ${paths.length} files · ${frontend ? "frontend" : "—"}${
        requireBackend ? ` / ${backend ? "backend" : "—"}` : " (frontend-focused mission)"
      } + docs.`
    : `Verification flagged ${issues.length} issue${issues.length === 1 ? "" : "s"}.`;
  return {
    ok,
    summary,
    issues,
    coverage: { frontend, backend, readme, docs, notesOnly },
    artifactPathCount: paths.length,
  };
}

/** Path checks + Tailwind/stack + static UI heuristics (needs file contents map). */
function verifySwarmDeliverables(
  paths: string[],
  contents: Map<string, string>,
  title: string,
  objective: string,
): SwarmVerificationReport {
  const base = verifyArtifactCoverage(paths, { title, objective });
  if (contents.size === 0) return base;
  const extra = [
    ...verifyTailwindStack(paths, contents, title, objective),
    ...verifyUiContentHeuristics(contents, title, objective),
    ...verifyViteApiUrlAntipattern(contents),
    ...verifyStaleViteToolchain(contents),
    ...verifyReactRouterHasHomeRoute(contents),
    ...verifyNoHardcodedBasename(contents),
  ];
  if (extra.length === 0) return base;
  const issues = [...base.issues, ...extra];
  const ok = issues.length === 0;
  return {
    ...base,
    ok,
    issues,
    summary: ok ? base.summary : `Verification flagged ${issues.length} issue(s).`,
  };
}

export async function missionsRoutes(app: FastifyInstance, hub: RealtimeHub, cfg?: AppConfig) {
  app.get("/api/missions", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    // Per-wallet scoping: only return missions this wallet created. Previously the endpoint
    // returned every mission globally → any connected wallet saw missions from other users.
    return { missions: await hivemindStore().listMissions(wallet) };
  });

  app.get("/api/missions/:id/live-metrics", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const st = hivemindStore();
    const m = await st.getMission(id);
    if (!m) return reply.status(404).send({ error: "not_found" });
    const [tasks, agents] = await Promise.all([st.listTasks(id), st.listAgents()]);
    return computeMissionLiveMetrics(m, tasks, agents);
  });

  /**
   * Wallet-scoped Agent Workspace UI (chat, reasoning logs, timeline); syncs across devices.
   */
  app.get("/api/missions/:id/workspace-snapshot", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const id = (req.params as { id: string }).id;
    const row = await hivemindStore().getMissionWorkspaceSnapshot(wallet, id);
    if (!row) return reply.status(404).send({ error: "not_found" });
    return { snapshot: row.payload, updatedAt: row.updatedAt };
  });

  app.put("/api/missions/:id/workspace-snapshot", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const id = (req.params as { id: string }).id;
    const parsed = workspaceSnapshotPut.safeParse(req.body ?? {});
    if (!parsed.success)
      return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    const updatedAt = await hivemindStore().putMissionWorkspaceSnapshot(wallet, id, parsed.data);
    return { ok: true as const, updatedAt };
  });

  /**
   * POST /api/missions/:id/brief
   * Generates and persists a mission brief (expanded spec) used as canonical context for agentic runs.
   */
  app.post("/api/missions/:id/brief", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    void wallet;

    const id = (req.params as { id: string }).id;
    const parsedBody = createBriefBody.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return reply.status(400).send({ error: "invalid_body", details: parsedBody.error.flatten() });
    }

    const st = hivemindStore();
    const m = await st.getMission(id);
    const title = (m?.title ?? parsedBody.data?.title)?.trim();
    const objective = (m?.objective ?? parsedBody.data?.objective)?.trim();
    if (!title || !objective) {
      return reply.status(400).send({ error: "missing_context", message: "Mission not found; send { title, objective }." });
    }

    const existingBrief = m?.config && "brief" in m.config ? (m.config as any).brief : undefined;
    if (m && existingBrief && !parsedBody.data?.force) {
      return { ok: true as const, brief: existingBrief, cached: true };
    }

    const agents = await st.listAgents();
    const agent =
      agents.find((a) => a.specialization === "Coordination") ??
      agents.find((a) => a.specialization === "Strategy") ??
      agents[0];

    const res = await invokeAgentCompletion(
      cfg ?? ({ GROQ_API_KEY: undefined } as AppConfig),
      agent,
      briefPrompt(title, objective),
      `${title}\n${objective}`,
    );

    const brief = safeJsonParse(res.reply) ?? { summary: res.reply };
    const briefUpdatedAt = Date.now();
    let updated: Mission | undefined;
    if (m) {
      updated = await st.patchMission(id, {
        config: { ...(m.config ?? ({} as any)), brief, briefUpdatedAt } as any,
      });
      if (updated) {
        hub.broadcast({ type: "mission.updated", payload: updated }, `mission:${id}`);
        hub.broadcast({ type: "mission.updated", payload: updated }, "global");
      }
    }

    // Also leave a lightweight activity record.
    hub.broadcast(
      { type: "agent.activity", payload: { agent: agent.name, message: `[brief] generated`, ts: Date.now() } },
      `mission:${id}`,
    );

    return { ok: true as const, brief, cached: false, provider: res.provider, model: res.model };
  });

  /**
   * GET /api/missions/:id/artifacts
   * Lists persisted artifacts for this mission + wallet.
   */
  app.get("/api/missions/:id/artifacts", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const id = (req.params as { id: string }).id;
    const artifacts = await hivemindStore().listMissionArtifacts(wallet, id);
    return { artifacts };
  });

  /**
   * GET /api/missions/:id/artifacts.zip
   * ZIP of all artifacts for this mission (latest version per path). Wallet-auth required.
   */
  app.get("/api/missions/:id/artifacts.zip", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const id = (req.params as { id: string }).id;
    const st = hivemindStore();
    const artifacts = await st.listMissionArtifacts(wallet, id);
    const byPath = new Map<string, (typeof artifacts)[0]>();
    for (const a of artifacts) {
      const prev = byPath.get(a.path);
      if (!prev || a.createdAt > prev.createdAt) byPath.set(a.path, a);
    }
    if (byPath.size === 0) {
      return reply.status(404).send({ error: "no_artifacts" });
    }

    type ZipEntry = { name: string; buf: Buffer };
    const zipEntries: ZipEntry[] = [];
    const seen = new Set<string>();
    for (const [p, a] of byPath) {
      const entryName = safeZipEntryPath(p);
      if (!entryName || seen.has(entryName)) continue;
      seen.add(entryName);
      const text = typeof a.content === "string" ? a.content : String(a.content ?? "");
      zipEntries.push({ name: entryName, buf: Buffer.from(text, "utf8") });
    }

    if (zipEntries.length === 0) {
      return reply.status(404).send({ error: "no_artifacts" });
    }

    const safeName = id.replace(/[^\w.-]+/g, "_").slice(0, 64);
    try {
      const zip = new AdmZip();
      for (const e of zipEntries) zip.addFile(e.name, e.buf);
      const zipBuf = zip.toBuffer();
      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="hivemind-${safeName}-artifacts.zip"`);
      reply.header("Content-Length", String(zipBuf.length));
      return reply.send(zipBuf);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: "zip_failed" });
    }
  });

  /**
   * POST /api/missions/:id/preview/start
   * Materialize artifacts → build → run frontend+backend, then expose via /preview/:sessionId/.
   */
  /** Run mgr.start in the background and update previewJobs as it progresses. Used by both
   *  the async (202 + jobId) and legacy synchronous start endpoints. */
  const runPreviewBuildInBackground = async (
    jobId: string,
    wallet: string,
    missionId: string,
    latest: Array<{ path: string; content: string }>,
  ): Promise<void> => {
    try {
      const mgr = previewManager();
      const session = await mgr.start({ wallet, missionId, artifacts: latest });
      const url = `/preview/${session.id}/`;
      previewJobs.set(jobId, { status: "done", wallet, missionId, startedAt: Date.now(), sessionId: session.id, url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      previewJobs.set(jobId, { status: "failed", wallet, missionId, startedAt: Date.now(), error: msg.slice(0, 2000) });
    }
  };

  /** POST /api/missions/:id/preview/start — async. Returns 202 + jobId immediately, runs
   *  npm install + vite build in the background, frontend (or expired-page JS) polls
   *  /preview/status/:jobId. Synchronous run is preserved when `?sync=1` is set so callers
   *  who can tolerate a long-lived connection (none in production — Vercel kills at 30s) keep
   *  working. */
  app.post("/api/missions/:id/preview/start", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const id = (req.params as { id: string }).id;
    const st = hivemindStore();
    const artifacts = await st.listMissionArtifacts(wallet, id);
    const byPath = new Map<string, (typeof artifacts)[0]>();
    for (const a of artifacts) {
      const prev = byPath.get(a.path);
      if (!prev || a.createdAt > prev.createdAt) byPath.set(a.path, a);
    }
    const latest = [...byPath.values()].map((a) => ({ path: a.path, content: a.content }));
    if (latest.length === 0) return reply.status(404).send({ error: "no_artifacts" });

    // Async path (default): kick off, return jobId, poll. This is what real clients use —
    // the synchronous one below gets killed by Vercel at 30s.
    const wantsAsync = (req.query as Record<string, string> | undefined)?.sync !== "1";
    if (wantsAsync) {
      const jobId = `prev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      previewJobs.set(jobId, { status: "running", wallet, missionId: id, startedAt: Date.now() });
      void reply.status(202).send({ jobId, status: "running" });
      void runPreviewBuildInBackground(jobId, wallet, id, latest);
      return;
    }

    // Legacy synchronous path — kept for internal scripts / curl users who can wait. Will
    // exceed the 30 s edge timeout on Vercel and is not used by the SPA or the expired page.
    try {
      const mgr = previewManager();
      const session = await mgr.start({ wallet, missionId: id, artifacts: latest });
      const url = `/preview/${session.id}/`;
      return { ok: true as const, sessionId: session.id, url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      req.log.error({ err: e, missionId: id }, "preview_start_failed");
      const safe = msg.replace(/\s+/g, " ").slice(0, 800);
      return reply.status(502).send({
        error: "preview_start_failed",
        message:
          "Could not build or start the preview session. If this times out on first try, " +
          "wait and retry — npm install + Vite build can take several minutes on a small server. " +
          `Detail: ${safe}`,
      });
    }
  });

  /** GET /api/missions/:id/preview/status/:jobId — poll preview-build status. */
  app.get("/api/missions/:id/preview/status/:jobId", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const { id, jobId } = req.params as { id: string; jobId: string };
    const job = previewJobs.get(jobId);
    if (!job) return reply.status(404).send({ error: "not_found", message: "Preview job expired or never existed." });
    if (job.wallet !== wallet || job.missionId !== id) return reply.status(403).send({ error: "forbidden" });
    return {
      status: job.status,
      sessionId: job.sessionId ?? null,
      url: job.url ?? null,
      error: job.error ?? null,
    };
  });

  /**
   * /preview/:sessionId/api/*
   * Proxies API requests to the preview backend.
   */
  app.all("/preview/:sessionId/api/*", async (req, reply) => {
    const sessionId = (req.params as { sessionId: string }).sessionId;
    const mgr = previewManager();
    const s = mgr.get(sessionId);
    if (!s) return reply.status(404).send({ error: "preview_not_found" });
    const sidRe = escapeRegExpToken(sessionId);
    const url = new URL(req.url ?? "/", "http://localhost");
    const upstreamPath =
      url.pathname.replace(new RegExp(`^/preview/${sidRe}/api`), "") + url.search;
    const upstream = `http://127.0.0.1:${s.backendPort}${upstreamPath || "/"}`;

    try {
      const body =
        req.method === "GET" || req.method === "HEAD" ? undefined : (req.body as any);
      const r = await fetch(upstream, {
        method: req.method,
        headers: { ...req.headers, host: undefined } as any,
        body: body ? JSON.stringify(body) : undefined,
      });
      reply.status(r.status);
      r.headers.forEach((v, k) => {
        const lk = k.toLowerCase();
        if (lk === "content-encoding" || lk === "transfer-encoding") return;
        reply.header(k, v);
      });
      const text = await r.text();
      return reply.send(text);
    } catch (e) {
      req.log.error({ err: e, sessionId, upstream }, "preview_api_proxy_failed");
      return reply.status(502).send({
        error: "preview_upstream_failed",
        message: "Preview API process is not reachable (session may have expired after deploy or restart). Start the preview again from the workspace.",
      });
    }
  });

  /**
   * GET /preview/:sessionId/*
   * Proxies the preview frontend (built static dist server).
   */
  /** Extract the mission id from a session id encoded as `P-<random>-m-<missionId_with_underscores>`. */
  const missionIdFromSessionId = (sessionId: string): string | null => {
    const m = sessionId.match(/^P-[0-9a-f]+-m-(.+)$/);
    return m && m[1] ? m[1].replace(/_/g, "-") : null;
  };

  /** Friendly HTML for expired/broken preview sessions. When the session id carries a mission
   *  id, the page rebuilds the preview IN-PLACE: fetch /api/missions/:id/preview/start from
   *  this same origin (the JWT lives in localStorage under "hm_jwt" because both the SPA and
   *  this page share hivemind.0xo.in), show progress, then redirect to the new preview URL.
   *  No navigation to the workspace required — the user stays on this tab. */
  const previewExpiredHtml = (sessionId: string, reason: "not_found" | "unreachable"): string => {
    const heading = reason === "not_found" ? "Preview not available" : "Preview expired";
    const body =
      reason === "not_found"
        ? `Session <code>${sessionId}</code> doesn’t exist on this server. It may have been cleaned up after a deploy or restart.`
        : `The build server for session <code>${sessionId}</code> isn’t responding. The session ended after a server restart.`;
    const missionId = missionIdFromSessionId(sessionId);
    // Escape for HTML / JS string contexts (missionId comes from the URL path, so theoretically attacker-controlled).
    const safeMission = missionId ? missionId.replace(/[^A-Za-z0-9_-]/g, "") : "";
    return [
      "<!doctype html>",
      "<html lang=\"en\"><head><meta charset=\"utf-8\">",
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
      `<title>${heading} — HiveMind</title>`,
      "<style>",
      "html,body{margin:0;height:100%;background:#04060c;color:#e6edf6;font:14px/1.55 ui-sans-serif,system-ui,-apple-system}",
      ".wrap{max-width:520px;margin:14vh auto;padding:24px;text-align:center}",
      "h1{font-size:18px;margin:0 0 8px;color:#67e8f9}",
      "p{color:#94a3b8;margin:0 0 14px}",
      "code{background:#0a1220;color:#a5f3fc;padding:1px 5px;border-radius:4px;font-family:ui-monospace,monospace;font-size:12px}",
      ".btn{display:inline-block;margin-top:6px;padding:9px 20px;border:1px solid #22d3ee55;border-radius:8px;color:#67e8f9;text-decoration:none;font-weight:500;background:#22d3ee0c;cursor:pointer;font-family:inherit;font-size:13px}",
      ".btn:hover{background:#22d3ee20;border-color:#22d3ee99}",
      ".btn:disabled{opacity:0.55;cursor:wait}",
      ".muted{color:#64748b;font-size:11px;margin-top:18px;font-family:ui-monospace,monospace}",
      ".spinner{display:inline-block;width:11px;height:11px;border:2px solid #22d3ee55;border-top-color:#67e8f9;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:-1px;margin-right:6px}",
      "@keyframes spin{to{transform:rotate(360deg)}}",
      ".err{color:#fca5a5;font-size:12px;margin-top:14px;text-align:left;background:#1a0d10;border:1px solid #ef444444;border-radius:6px;padding:10px 12px;font-family:ui-monospace,monospace;white-space:pre-wrap;max-height:200px;overflow:auto}",
      "</style></head><body><div class=\"wrap\">",
      `<h1>${heading}</h1><p>${body}</p>`,
      safeMission
        ? `<p>Click below to rebuild the preview for mission <code>${safeMission}</code> — you'll stay on this tab.</p>`
        : "<p>Open the Agent Workspace and click <strong>Host</strong> again to spawn a fresh preview.</p>",
      safeMission
        ? `<button id="rebuild" class="btn" type="button">Rebuild this preview</button>`
        : `<a class="btn" href="/agents">Open Agent Workspace</a>`,
      "<div id=\"status\"></div>",
      safeMission
        ? `<p class="muted">If this never finishes, the wallet that built the original mission may not be signed in. Open <a style="color:#67e8f9" href="/agents?mission=${safeMission}">the workspace</a> and click Host there.</p>`
        : "",
      "</div>",
      safeMission
        ? `<script>
(function(){
  var MISSION = ${JSON.stringify(safeMission)};
  var btn = document.getElementById('rebuild');
  var status = document.getElementById('status');
  if (!btn || !status) return;
  function setProgress(html, color) {
    status.innerHTML = '<p style="color:' + (color || '#67e8f9') + '">' +
      '<span class="spinner"></span>' + html + '</p>';
  }
  function setError(detail) {
    status.innerHTML = '<div class="err">' + String(detail).replace(/[<>]/g, '') + '</div>' +
      '<p class="muted">Open <a style="color:#67e8f9" href="/agents?mission=' + encodeURIComponent(MISSION) + '">the workspace</a> and ask the swarm in chat to fix the build error.</p>';
    btn.disabled = false;
  }
  function pollStatus(jwt, jobId, started) {
    var elapsed = Math.round((Date.now() - started) / 1000);
    setProgress('Rebuilding — npm install + vite build (' + elapsed + 's elapsed; usually 1-5 min)…');
    fetch('/api/missions/' + encodeURIComponent(MISSION) + '/preview/status/' + encodeURIComponent(jobId), {
      headers: { 'Authorization': 'Bearer ' + jwt },
    }).then(function(r){
      if (r.status === 401 || r.status === 403) { setError('Session expired — sign in again.'); return; }
      if (r.status === 404) { setError('Preview job no longer exists — try again.'); return; }
      return r.json();
    }).then(function(j){
      if (!j) return;
      if (j.status === 'done' && j.url) {
        status.innerHTML = '<p style="color:#86efac">Preview ready — loading…</p>';
        window.location.href = j.url;
        return;
      }
      if (j.status === 'failed') {
        setError(j.error || 'Build failed.');
        return;
      }
      // Still running — poll again.
      setTimeout(function(){ pollStatus(jwt, jobId, started); }, 4000);
    }).catch(function(e){
      // Transient network blip — retry once more before surfacing.
      setTimeout(function(){ pollStatus(jwt, jobId, started); }, 5000);
    });
  }
  btn.addEventListener('click', function(){
    btn.disabled = true;
    setProgress('Starting the rebuild…');
    var jwt = null;
    try { jwt = localStorage.getItem('hm_jwt'); } catch (e) {}
    if (!jwt) {
      status.innerHTML = '<p style="color:#fca5a5">Sign in with your wallet first. ' +
        '<a style="color:#67e8f9" href="/agents?mission=' + encodeURIComponent(MISSION) + '&autoHost=1">Open the workspace to sign in</a>.</p>';
      btn.disabled = false;
      return;
    }
    fetch('/api/missions/' + encodeURIComponent(MISSION) + '/preview/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
      body: '{}',
    }).then(function(r){
      return r.json().then(function(j){ return { ok: r.ok || r.status === 202, status: r.status, body: j }; });
    }).then(function(res){
      if (res.ok && res.body && res.body.jobId) {
        pollStatus(jwt, res.body.jobId, Date.now());
        return;
      }
      // Legacy sync response (older backend) — { ok, url }.
      if (res.ok && res.body && res.body.url) {
        status.innerHTML = '<p style="color:#86efac">Preview ready — loading…</p>';
        window.location.href = res.body.url;
        return;
      }
      setError((res.body && (res.body.message || res.body.error)) || ('HTTP ' + res.status));
    }).catch(function(e){
      setError((e && e.message) || e);
    });
  });
})();
</script>`
        : "",
      "</body></html>",
    ].join("\n");
  };

  app.all("/preview/:sessionId/*", async (req, reply) => {
    const sessionId = (req.params as { sessionId: string }).sessionId;
    const mgr = previewManager();
    const s = mgr.get(sessionId);
    if (!s) {
      return reply
        .status(404)
        .header("Cache-Control", "no-store, no-cache, must-revalidate")
        .type("text/html; charset=utf-8")
        .send(previewExpiredHtml(sessionId, "not_found"));
    }

    const sidRe = escapeRegExpToken(sessionId);
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathnameStripped = url.pathname.replace(new RegExp(`^/preview/${sidRe}`), "");
    const upstreamPath = (pathnameStripped === "" ? "/" : pathnameStripped) + url.search;
    const upstream = `http://127.0.0.1:${s.frontendPort}${upstreamPath}`;
    try {
      const r = await fetch(upstream, {
        method: req.method,
        headers: { ...(req.headers as Record<string, string | undefined>), host: undefined } as any,
      });
      reply.status(r.status);

      const hopByHop = new Set([
        "content-encoding",
        "transfer-encoding",
        "connection",
        "keep-alive",
        "proxy-connection",
        "content-length",
      ]);
      const upstreamCt = (r.headers.get("content-type") ?? "").trim();
      r.headers.forEach((v, k) => {
        const lk = k.toLowerCase();
        if (hopByHop.has(lk)) return;
        if (lk === "content-type") return;
        reply.header(k, v);
      });
      const pathOnly = pathnameStripped.split("?")[0] || "/";
      const contentType = upstreamCt.length > 0 ? upstreamCt : guessPreviewStaticMime(pathOnly);
      reply.header("Content-Type", contentType);
      // Tell every intermediary cache to leave preview HTML alone — it changes per repair round.
      if (contentType.startsWith("text/html")) {
        reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
      }

      if (req.method === "HEAD") {
        const cl = r.headers.get("content-length");
        if (cl) reply.header("content-length", cl);
        return reply.send();
      }

      const buf = Buffer.from(await r.arrayBuffer());
      return reply.send(buf);
    } catch (e) {
      req.log.error({ err: e, sessionId, upstream }, "preview_static_proxy_failed");
      return reply
        .status(502)
        .header("Cache-Control", "no-store, no-cache, must-revalidate")
        .type("text/html; charset=utf-8")
        .send(previewExpiredHtml(sessionId, "unreachable"));
    }
  });

  /**
   * POST /api/missions/:id/auto-invoke
   * Optional JSON body: { title, objective } — required when this mission id
   * is not stored on the server (local-only missions).
   */
  app.post("/api/missions/:id/auto-invoke", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsedBody = autoInvokeBody.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return reply.status(400).send({ error: "invalid_body", details: parsedBody.error.flatten() });
    }
    const st = hivemindStore();
    const m = await st.getMission(id);
    const title = (m?.title ?? parsedBody.data?.title)?.trim();
    const objective = (m?.objective ?? parsedBody.data?.objective)?.trim();
    if (!title || !objective) {
      return reply.status(400).send({
        error: "missing_context",
        message:
          "Mission not on the API for this id. Send JSON body { \"title\": \"...\", \"objective\": \"...\" } (same as your mission).",
      });
    }

    const agents = await st.listAgents();
    if (agents.length === 0) return reply.status(503).send({ error: "no_agents" });

    const spec = detectAgentSpecialization(title, objective);
    const agent =
      agents.find((a) => a.specialization === spec) ??
      agents.find((a) => a.specialization === "Strategy") ??
      agents[0];

    const t0 = Date.now();
    const result = await invokeAgentCompletion(
      cfg ?? ({ GROQ_API_KEY: undefined } as AppConfig),
      agent,
      objective,
      `${title}\n${objective}`,
    );
    const latencyMs = Date.now() - t0;

    const etaLabel =
      latencyMs < 1000
        ? `${latencyMs}ms`
        : latencyMs < 60_000
          ? `${(latencyMs / 1000).toFixed(1)}s`
          : `${Math.round(latencyMs / 60_000)}m ${Math.round((latencyMs % 60_000) / 1000)}s`;

    let updated: Mission | undefined;
    if (m) {
      await st.createTask({
        missionId: id,
        title: title.slice(0, 80),
        agent: agent.specialization,
        status: "done",
        stage: "Execution",
      });
      updated = await st.patchMission(id, { eta: etaLabel, progress: 10 });
    }

    const activity = {
      agent: agent.name,
      message: `[auto] ${result.reply.slice(0, 560)}`,
      ts: Date.now(),
    };
    hub.broadcast({ type: "agent.activity", payload: activity }, "global");
    hub.broadcast({ type: "agent.activity", payload: activity }, `mission:${id}`);

    return {
      agentId: agent.id,
      agentName: agent.name,
      specialization: agent.specialization,
      reply: result.reply,
      provider: result.provider,
      model: result.model,
      latencyMs,
      etaLabel,
      persisted: Boolean(m),
      mission: updated ?? null,
      ...(result.llmFailure ? { debugLlm: result.llmFailure.slice(0, 400) } : {}),
    };
  });

  /**
   * POST /api/missions/:id/swarm-run
   * Runs the mission across all configured roles (typically 6) with handoffs:
   * Strategy → Research → Design → Development → Marketing → Treasury/Analytics → Coordination (final synthesis).
   *
   * Important: this is not a "6 separate answers". Each step receives prior
   * outputs, and Coordination returns the final integrated deliverable.
   */
  app.post("/api/missions/:id/swarm-run", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const id = (req.params as { id: string }).id;
    const parsedBody = autoInvokeBody.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return reply.status(400).send({ error: "invalid_body", details: parsedBody.error.flatten() });
    }
    const st = hivemindStore();
    const m = await st.getMission(id);
    if (!m) return reply.status(404).send({ error: "not_found" });
    const title = m.title.trim();
    const objective = m.objective.trim();

    const agents = await st.listAgents();
    if (agents.length === 0) return reply.status(503).send({ error: "no_agents" });

    const SWARM_DEFAULT_ROLES = [
      "Strategy",
      "Research",
      "Design",
      "Development",
      "Marketing",
      "Treasury",
      "Analytics",
      "Coordination",
    ];

    const dedupePreserve = (items: string[]): string[] => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const x of items) {
        if (seen.has(x)) continue;
        seen.add(x);
        out.push(x);
      }
      return out;
    };

    /** Missions created from the UI often omitted Development — without it the swarm only writes notes/*.md. */
    const ensureDevelopmentInSwarm = (roles: string[]): string[] => {
      if (roles.includes("Development")) return roles;
      const r = [...roles];
      const designIdx = r.indexOf("Design");
      if (designIdx >= 0) {
        r.splice(designIdx + 1, 0, "Development");
        return r;
      }
      const coordIdx = r.indexOf("Coordination");
      if (coordIdx >= 0) {
        r.splice(coordIdx, 0, "Development");
        return r;
      }
      r.push("Development");
      return r;
    };

    let configuredRoles = dedupePreserve(
      (m?.agents?.length ? [...m.agents] : [...SWARM_DEFAULT_ROLES]).slice(0, 16),
    );
    configuredRoles = ensureDevelopmentInSwarm(configuredRoles);

    const roleOrder = [
      "Strategy",
      "Research",
      "Design",
      "Development",
      "Marketing",
      "Treasury",
      "Analytics",
      "Coordination",
    ].filter((r) => configuredRoles.includes(r));
    // Ensure Coordination runs last (even if not in configured list, we can still pick Strategy as fallback).
    const roles = roleOrder.length > 0 ? roleOrder : configuredRoles;

    // Idempotency: if a swarm is already running, don't start another.
    // If it already completed, avoid creating duplicates.
    const existingTasks = m ? await st.listTasks(id) : [];
    if (m) {
      const hasInFlight = existingTasks.some((t) => t.status === "queued" || t.status === "active");
      if (hasInFlight) {
        return reply.status(409).send({ error: "already_running", message: "Swarm run already in progress for this mission." });
      }
      const relevant = existingTasks.filter((t) => t.stage === "Execution" && roles.includes(t.agent));
      const alreadyDone = relevant.length > 0 && relevant.every((t) => t.status === "done");
      if (alreadyDone) {
        return {
          persisted: true,
          etaLabel: m.eta ?? "—",
          startedAt: m.createdAt,
          finishedAt: Date.now(),
          results: [],
          finalReply: "",
          mission: m,
          alreadyCompleted: true,
        };
      }
    }

    // ── Respond immediately so the HTTP proxy never times out ────────────────
    const jobId = `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const jobStartedAt = Date.now();
    swarmJobs.set(jobId, { status: "running", missionId: id, wallet, startedAt: jobStartedAt });
    void reply.status(202).send({ jobId, status: "running" });

    // Everything below runs in the background — the HTTP response is already sent.
    void (async () => {
    try {

    const startedAt = Date.now();

    // Ensure a Mission Brief exists before running roles.
    const currentBrief = m.config && "brief" in m.config ? (m.config as any).brief : undefined;
    let brief = currentBrief;
    if (!brief) {
      const briefAgent =
        agents.find((a) => a.specialization === "Coordination") ??
        agents.find((a) => a.specialization === "Strategy") ??
        agents[0];
      const briefRes = await invokeAgentCompletion(
        cfg ?? ({ GROQ_API_KEY: undefined } as AppConfig),
        briefAgent,
        briefPrompt(title, objective),
        `${title}\n${objective}`,
      );
      brief = safeJsonParse(briefRes.reply) ?? { summary: briefRes.reply };
      const briefUpdatedAt = Date.now();
      const patched = await st.patchMission(id, {
        config: { ...(m.config ?? ({} as any)), brief, briefUpdatedAt } as any,
      });
      if (patched) {
        hub.broadcast({ type: "mission.updated", payload: patched }, `mission:${id}`);
        hub.broadcast({ type: "mission.updated", payload: patched }, "global");
      }
      hub.broadcast(
        { type: "agent.activity", payload: { agent: briefAgent.name, message: `[brief] generated`, ts: Date.now() } },
        `mission:${id}`,
      );
    }

    hub.broadcast(
      {
        type: "agent.activity",
        payload: {
          agent: "HiveMind",
          message: `[system] Mission started · "${title}" · Routing ${roles.length} agents: ${roles.join(" → ")}`,
          ts: Date.now(),
        },
      },
      `mission:${id}`,
    );

    // Create tasks if mission is persisted on the server (dedupe by role).
    const taskByRole = new Map<string, { id: string; missionId: string; role: string }>();
    if (m) {
      const byRole = new Map<string, { id: string }>();
      for (const t of existingTasks) {
        if (t.stage === "Execution" && roles.includes(t.agent)) byRole.set(t.agent, { id: t.id });
      }
      for (const role of roles) {
        const existing = byRole.get(role);
        if (existing) {
          taskByRole.set(role, { id: existing.id, missionId: id, role });
          continue;
        }
        const t = await st.createTask({
          missionId: id,
          title: `${role}: ${title}`.slice(0, 120),
          agent: role,
          status: "queued",
          stage: "Execution",
        });
        taskByRole.set(role, { id: t.id, missionId: id, role });
        hub.broadcast({ type: "task.created", payload: t }, `mission:${id}`);
      }
    }

    const outputByRole = new Map<string, { agentName: string; specialization: string; reply: string }>();

    type ParsedArtifacts = {
      summary?: string;
      artifacts?: Array<{ path: string; language?: string; content: string; kind?: "file" | "note" }>;
    };
    const parseArtifacts = (raw: string): ParsedArtifacts | null => {
      const parsed = safeJsonParse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const obj = parsed as any;
      if (!Array.isArray(obj.artifacts) && typeof obj.summary !== "string") return null;
      const artifacts = Array.isArray(obj.artifacts)
        ? obj.artifacts
            .filter((a: any) => a && typeof a.path === "string" && typeof a.content === "string")
            .map((a: any) => ({
              path: a.path,
              language: typeof a.language === "string" ? a.language : undefined,
              content: a.content,
              kind: a.kind === "note" ? "note" : "file",
            }))
        : undefined;
      return {
        summary: typeof obj.summary === "string" ? obj.summary : undefined,
        artifacts,
      };
    };

    const pickAgent = (role: string) => {
      const agent =
        agents.find((a) => a.specialization === role) ??
        agents.find((a) => a.specialization === "Strategy") ??
        agents[0];
      return agent;
    };

    const renderContext = (currentRole?: string) => {
      const briefBlock =
        typeof brief === "string" ? brief : JSON.stringify(brief, null, 2);

      // Development gets MINIMAL context to stay within Groq TPM limits.
      // Full prior-agent context (~18K chars) alone exceeds the 6K TPM budget.
      // Only pass the mission anchor + a design spec excerpt (≤1,200 chars total).
      if (currentRole === "Development") {
        const designEntry = outputByRole.get("Design");
        const designSnippet = designEntry?.reply.trim().slice(0, 800) ?? "";
        const parts = [
          `## Mission\nTitle: ${title}\nObjective: ${objective}`,
          designSnippet ? `## Design spec excerpt\n${designSnippet}` : "",
        ].filter(Boolean);
        return parts.join("\n\n");
      }

      // Coordination sees medium context; all others get brief summaries.
      const snippetLimit = (role: string) =>
        role === "Coordination" ? 3000 : 1400;
      const parts = [
        `## Mission brief (canonical spec)\n${briefBlock.slice(0, 2000)}`,
        ...[...outputByRole.entries()].map(([role, v]) => {
          const limit = snippetLimit(currentRole ?? role);
          const snippet = v.reply.trim().slice(0, limit);
          return `## ${role} output (${v.agentName})\n${snippet}${v.reply.length > snippet.length ? "\n…" : ""}`;
        }),
      ];
      return parts.length ? parts.join("\n\n") : "(none yet)";
    };

    const needBackendStack = missionRequiresBackend(title, objective);

    const roleInstruction = (role: string) => {
      switch (role) {
        case "Strategy":
          return [
            "Think like a senior product strategist briefing the rest of the team.",
            "Deliver: (1) **Product summary** — one paragraph, the elevator pitch. (2) **Target user + JTBD** — who and what they're hiring this for. (3) **Scope** — bullet list of in-scope features with priority (P0/P1/P2); explicitly list what's OUT of scope. (4) **Core components** — concrete subsystems each downstream agent will need. (5) **Success criteria** — measurable acceptance bar. (6) **File tree proposal** — repo skeleton the Development agent should produce. (7) **Risks + mitigations** — top 3.",
            "Make decisive choices instead of listing options. Tailor scope to the brief (UI-only vs full-stack vs research-only vs DAO ops). Never use a generic boilerplate template.",
          ].join("\n");
        case "Research":
          return [
            "Think like a principal analyst briefing the team before they build.",
            "Deliver: (1) **Competitive landscape** — 3-5 direct/adjacent competitors with one-line positioning each. (2) **Best practices** — security, audits, compliance, design patterns relevant to this brief. (3) **Stack / chain recommendation** — pick one, justify in 1-2 sentences, list trade-offs. (4) **Non-obvious insight** — the thing downstream agents would otherwise miss. (5) **Risks + mitigation** — ranked by impact.",
            "Mark every factual claim as either Cited (with a real source) or Inference. Never fabricate sources.",
          ].join("\n");
        case "Design":
          return [
            "Think like a lead product designer writing a spec another developer will implement WITHOUT asking questions.",
            "Return STRICT JSON only (no markdown fences, no prose outside the JSON) with:",
            `{ "summary": string, "artifacts": [{ "path": "design/ui-spec.md", "language": "md", "content": string, "kind": "file" }] }`,
            "The ui-spec.md MUST include, in this exact order:",
            "  1. **Product summary** — what we're shipping, one paragraph.",
            "  2. **Information architecture** — pages/routes with their purpose.",
            "  3. **User flows** — for each primary flow: trigger → steps → success state.",
            "  4. **Design tokens** — concrete Tailwind classes / CSS variables for: color palette (primary/accent/neutral/success/warning/error with hex), typography scale (font family + sizes), spacing scale, border-radius, shadow elevations, dark-mode behavior.",
            "  5. **Component library** — each component as: `### ComponentName` + Props table (name / type / required / description) + Layout description + States (default/hover/disabled/loading/error) + Tailwind utility classes to apply + accessibility notes.",
            "  6. **Page compositions** — for each page, the exact composition of components, layout, copy.",
            "  7. **Responsive breakpoints** — sm/md/lg/xl behavior per page.",
            "  8. **Micro-interactions** — hover / focus / transition timings.",
            "Write the spec so Development can paste classNames straight from it. Be specific (`bg-cyan-500/15 text-cyan-200`) not vague (`use accent color`).",
          ].join("\n");
        case "Development":
          return [
            "Think like a staff engineer reading the Design spec from the prior agent. Your job: turn that spec into structured, production-grade React+TypeScript code. READ THE DESIGN UI-SPEC CAREFULLY — the className strings, component names, props, and page compositions in it are the contract. Match them.",
            "You ship a runnable codebase — not a narrative. Implement the mission brief as real source files (content, stacks, and file set must follow the brief — avoid copy-pasting unrelated demo apps).",
            "Return STRICT JSON only (no markdown fences, no prose outside the JSON) with:",
            `{ "summary": string, "artifacts": [{ "path": string, "language": string, "content": string, "kind": "file" }] }`,
            "Each artifact.path MUST be a repo-relative path with extension (e.g. frontend/package.json, frontend/src/App.tsx, backend/src/server.ts when applicable).",
            "Each artifact.content MUST be complete file bodies (paste-ready), using TypeScript/TSX/JS/HTML/CSS as appropriate — not descriptions of code.",
            "Do not put JSX/TSX syntax in files named *.js — use .tsx / .jsx or plain JS without JSX.",
            "",
            "## BUILD CONTRACT — your code MUST compile",
            "Before finalizing your JSON response, mentally run this checklist:",
            "1. Every `import X from 'pkg'` → 'pkg' exists in frontend/package.json dependencies.",
            "2. Every `import X from './path'` → the file at ./path.tsx (or .ts/.js) exists in your artifacts.",
            "3. No duplicate default exports in a single file.",
            "4. No `import React from 'react'` in files that use JSX with Vite (use `import { ... } from 'react'` or nothing — Vite's JSX transform is automatic).",
            "5. All packages you use must be listed in package.json. CRITICAL package name rules: use `lucide-react` (NOT `@lucide/react` — that package does NOT exist). Common omissions: framer-motion, recharts, zustand, phaser, socket.io-client, @radix-ui/* — add them explicitly.",
            "6. frontend/tsconfig.json must include `\"skipLibCheck\": true` and `\"jsx\": \"react-jsx\"`.",
            "If any item above is wrong, the Vite build WILL fail and you will be asked to repair it. Fix it now.",
            "",
            "Default frontend stack: Tailwind CSS v3 (`tailwindcss: \"^3.4.0\"` + `postcss: \"^8.4.47\"` + `autoprefixer: \"^10.4.20\"` as devDependencies), `tailwind.config.ts` with `content: ['./index.html', './src/**/*.{ts,tsx}']`, `postcss.config.js` exporting `{ plugins: { tailwindcss: {}, autoprefixer: {} } }`, and `@tailwind base/components/utilities` directives in CSS entry. NEVER use `tailwindcss: 'latest'` (installs v4 which breaks the build). NEVER use `@tailwindcss/vite` unless you also use `@import 'tailwindcss'` (v4 syntax) and omit postcss.config.js entirely. Never ship a bare unstyled page.",
            "Production quality bar (applies to ALL missions):",
            "- Split UI into multiple component files under `frontend/src/components/` — never put the entire UI in a single App.tsx.",
            "- Add loading states (spinners/skeletons) and error states for every async operation.",
            "- Include form validation with user-visible error messages where forms exist.",
            "- Use responsive layout (flex/grid + Tailwind sm:/md:/lg: breakpoints).",
            ...(isUiPolishMission(title, objective)
              ? [
                  "This is a UI-heavy mission — deliver visual depth: nav with logo + links, hero with headline + CTA, ≥2 content sections, footer. Typography hierarchy (text-4xl/2xl/lg), color palette, shadows.",
                ]
              : []),
            "Artifacts MUST include at minimum:",
            "- frontend/: Vite+React — include frontend/index.html, frontend/package.json, frontend/vite.config.ts (or .js), frontend/src/main.tsx, frontend/src/App.tsx, and any components the brief needs.",
            "frontend/package.json MUST pin `vite` to ^5.4.x (or newer 5.x) and `@vitejs/plugin-react` to ^4.3.x — do NOT ship Vite 2/3; plugin-react expects `vite.createFilter` which those versions omit → preview/build crashes.",
            "- If you ship vanilla HTML instead, include frontend/index.html plus assets and ensure it is a complete page (e.g. login if the brief asks).",
            ...(needBackendStack
              ? [
                  "- backend/: MUST include backend/package.json (with scripts.start) AND backend/src/index.ts or server.ts with ≥2 routes matching the brief",
                  "- README.md at repo root with install + dev commands for both frontend and backend",
                  "API base URL: HiveMind preview sets import.meta.env.VITE_API_URL to the full API root (…/api). Use fetch(`${import.meta.env.VITE_API_URL}/your-route`) with NO extra `/api/` segment — never `${...VITE_API_URL}/api/...` or you get /api/api and 500s.",
                  "After fetch: check response.ok; parse JSON safely; use Array.isArray(data) ? data : [] (or default) before .map to avoid blank UI crashes.",
                ]
              : [
                  "- README.md at repo root with install + dev commands for the frontend (document backend only if you actually ship backend/).",
                  "If the brief is UI/marketing-only, do not add a throwaway API — prioritize depth on layout, styling, copy, and components that match the mission.",
                ]),
            "If you use react-router BrowserRouter, set basename={import.meta.env.BASE_URL} (Vite sets BASE_URL at build time for hosted previews).",
            "Use react-router-dom v6 APIs only: Routes (not Switch), Route element={<Page />} (not component={Page}), Navigate (not Redirect), useNavigate (not useHistory).",
          ].join("\n");
        case "Marketing":
          return [
            "Think like a growth lead at a hyper-growth startup. Your scope covers branding, copywriting, pitch deck, and launch — write all of them as if a real team will ship them tomorrow.",
            "Deliver in this exact order: (1) **Brand identity** — product name (if not set), tagline, voice/tone (3 adjectives), positioning sentence (\"X is the only Y that Z\"). (2) **Landing page copy** — hero headline (8-10 words, benefit-led), subhead (1-2 sentences), primary CTA, 3-5 feature bullets with name + 1-line benefit, social-proof line, FAQ (3 Qs). (3) **Pitch deck outline** — 10 slides max: Problem / Solution / Demo / Market / Traction / Business model / Competition / Team / Ask / Vision. One sentence per slide describing the punchline. (4) **Launch campaign** — Twitter thread (5-7 tweets), Product Hunt post draft, launch-day email subject + body, 3 partner-outreach DMs. (5) **GTM checklist** — actionable T-7 / T-3 / T-0 / T+1 / T+7 tasks.",
            "Copy must be specific and benefit-led (\"Ship a launch in 24h, not 6 weeks\"), not abstract marketing fluff (\"Empowering creators worldwide\").",
          ].join("\n");
        case "Treasury":
          return [
            "Think like a crypto-native CFO sizing the mission. For every allocation, give a rationale tied to runway/burn/risk, not just a percentage.",
            "Deliver: (1) **Budget split** — concrete percentages across agent-compute / token-usage / escrow / settlement-buffer / marketing (if applicable). (2) **Treasury parameters** — for Solana missions: SOL units, multi-sig threshold, vesting schedule (if relevant), escrow program reference, fee model. (3) **Operational controls** — who can spend, rate limits, audit cadence, kill-switch conditions. (4) **Risk model** — top 3 financial risks ranked by impact, each with one mitigation.",
            "Cite real on-chain primitives when relevant (SPL token mints, PDAs, vesting/escrow programs). Avoid hand-wavy `put money here` language.",
          ].join("\n");
        case "Analytics":
          return [
            "Think like a senior data engineer instrumenting this product on day one. Every metric needs an owner and a business outcome.",
            "Deliver: (1) **North Star metric** — one sentence, why it captures product value. (2) **Leading indicators** — 3-5 metrics that predict the North Star, with definition + target. (3) **Event schema** — table of event_name / when_fired / properties (name, type, example), in the format Mixpanel/PostHog accept. (4) **Dashboard outline** — 4-6 charts: title + metric + segmentation + filter. (5) **Alerts** — at least 2 condition+threshold+channel triples for production health.",
            "Distinguish vanity metrics (\"page views\") from actionable ones (\"7-day activation\"). Always pick the actionable one.",
          ].join("\n");
        case "Coordination":
          return [
            "You are the lead integrator — deliver the merged repo the user can run, not a meta-document. You don't paraphrase prior agents; you STITCH their outputs together.",
            "Before writing your JSON, audit the prior outputs: (1) Did Strategy define a clear file tree? — match it. (2) Did Design ship design/ui-spec.md with concrete Tailwind classes? — Development must follow them; you fix mismatches. (3) Did Development declare every dep it imports? — add the missing ones to frontend/package.json. (4) Did Marketing produce launch copy? — fold it into the landing page hero. (5) Did Treasury set parameters? — surface them in README or docs.",
            "Take ALL prior agent outputs and produce the FINAL integrated deliverable as concrete files shaped by the mission brief:",
            ...(isUiPolishMission(title, objective)
              ? [
                  "For UI-heavy missions, final frontend MUST include Tailwind (or justified alternative with equivalent layout/CSS depth) matching `design/ui-spec.md` — preview build must succeed.",
                ]
              : []),
            "- docs/ARCHITECTURE.md (architecture + data flows — for UI-only missions, focus on frontend structure and deployment)",
            "- docs/SECURITY.md (checklist scoped to what you ship)",
            needBackendStack
              ? "- frontend/ and backend/ trees with real code matching the brief (same rigor as Development); backend/ MUST include backend/package.json with scripts.start"
              : "- frontend/ polished to the brief; add backend/ only if earlier outputs or the brief require APIs, auth, or persistence; if you add backend/ you MUST include backend/package.json",
            "- Root README.md REQUIRED — must be in artifacts array at path 'README.md'",
            "",
            "Return STRICT JSON only (no markdown fences, no prose outside the JSON) with:",
            `{ "summary": string, "artifacts": [{ "path": string, "language": string, "content": string, "kind": "file" }] }`,
            "Synthesize; do not paste whole prior replies. Prefer code files over JSON-in-markdown placeholders.",
          ].join("\n");
        default:
          return "Produce your part only, aligned to the mission.";
      }
    };

    const pushProgress = (role: string, agentName: string, replySnippet: string, provider: string, model: string) => {
      const j = swarmJobs.get(jobId);
      if (!j) return;
      const prev = j.progress ?? { currentRole: null, completedRoles: [], partialResults: [] };
      swarmJobs.set(jobId, { ...j, progress: { currentRole: null, completedRoles: [...prev.completedRoles, role], partialResults: [...prev.partialResults, { role, agentName, replySnippet, provider, model }] } });
    };
    const setCurrentRole = (role: string | null) => {
      const j = swarmJobs.get(jobId);
      if (!j) return;
      swarmJobs.set(jobId, { ...j, progress: { ...(j.progress ?? { completedRoles: [], partialResults: [] }), currentRole: role } });
    };

    const runOne = async (role: string, opts?: { userSuffix?: string; artifactHeavy?: boolean }) => {
      const agent = pickAgent(role);
      const taskMeta = taskByRole.get(role);
      if (taskMeta) {
        const upd = await st.patchTask(taskMeta.id, { status: "active" });
        if (upd) hub.broadcast({ type: "task.updated", payload: upd }, `mission:${id}`);
      }

      const roleNarratives: Record<string, string> = {
        Strategy: `Analyzing mission scope and defining the implementation plan for "${title}". I'll break this into components, set success criteria, and create a file tree proposal.`,
        Research: `Running competitive analysis and gathering best practices for "${title}". Checking for security concerns, recommended stack choices, and risk areas.`,
        Design: `Designing UI/UX system for "${title}" — pages, user flows, component hierarchy, color tokens, and visual spec. This will guide Development.`,
        Development: `Building the full codebase for "${title}". Generating frontend (Vite + React + Tailwind), backend API routes, and root README — complete, paste-ready files.`,
        Marketing: `Creating go-to-market strategy and launch checklist for "${title}". Producing actionable distribution plan and copy.`,
        Treasury: `Defining treasury parameters and risk controls for "${title}". Covering budget splits, escrow defaults, and on-chain controls.`,
        Analytics: `Setting up KPIs, event schema, and monitoring dashboards for "${title}". Defining metrics and alert thresholds.`,
        Coordination: `Integrating all agent outputs into the final merged repository for "${title}". Synthesizing code, docs, and architecture into a runnable deliverable.`,
      };
      const narrative = roleNarratives[role] ?? `${role} agent processing "${title}"…`;
      hub.broadcast(
        { type: "agent.activity", payload: { agent: agent.name, message: `[plan] ${narrative}`, ts: Date.now() } },
        `mission:${id}`,
      );
      hub.broadcast(
        { type: "agent.activity", payload: { agent: agent.name, message: `[work] ${role} · building…`, ts: Date.now() } },
        `mission:${id}`,
      );
      setCurrentRole(role);

      const artifactJsonRoles = new Set(["Development", "Coordination", "Design"]);
      const landingSupplement =
        ["Design", "Development", "Coordination"].includes(role)
          ? buildLandingQualitySupplement(title, objective)
          : "";
      const artifactHeavyFlag = opts?.artifactHeavy ?? (role === "Development" || role === "Coordination");
      const missionConfig = (m as any)?.config as Record<string, unknown> | undefined;
      const missionPriorityKey = ((missionConfig?.priorityKey ?? "std") as string) as MissionPriority;
      const agentModelOverride = (missionConfig?.agentModels as Record<string, string> | undefined)?.[role];
      const invokeSwarmOpts = {
        swarmArtifactStep: artifactJsonRoles.has(role),
        artifactHeavy: artifactHeavyFlag,
        priority: missionPriorityKey,
        ...(agentModelOverride ? { modelOverride: agentModelOverride } : {}),
      };

      try {
        const allArtsForRag = await st.listMissionArtifacts(wallet, id);
        const designRagBlock = ["Design", "Development", "Coordination"].includes(role)
          ? buildDesignRagUserBlock(allArtsForRag)
          : "";
        const ctx = renderContext(role);
        const roleBlock = [
          `Your role: ${role}`,
          roleInstruction(role),
          landingSupplement,
          designRagBlock,
          opts?.userSuffix ? `\n${opts.userSuffix}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        // Provider applies a max user-message length (prefix kept) — put mandatory JSON/shape rules before the long agent context.
        const userMsg = artifactJsonRoles.has(role)
          ? [
              `Mission title: ${title}`,
              `Mission objective: ${objective}`,
              "",
              roleBlock,
              "",
              "Context from other agents so far:",
              ctx,
            ].join("\n")
          : [
              `Mission title: ${title}`,
              `Mission objective: ${objective}`,
              "",
              "Context from other agents so far:",
              ctx,
              "",
              roleBlock,
            ].join("\n");

        let res = await invokeAgentCompletion(
          cfg ?? ({ GROQ_API_KEY: undefined } as AppConfig),
          agent,
          userMsg,
          `${title}\n${objective}`,
          invokeSwarmOpts,
        );

        let parsedArtifacts = parseArtifacts(res.reply);
        if (
          artifactJsonRoles.has(role) &&
          (!parsedArtifacts?.artifacts || parsedArtifacts.artifacts.length === 0)
        ) {
          const retryMsg =
            userMsg +
            "\n\n---\nCRITICAL: Your previous reply was not usable JSON with a non-empty artifacts array. " +
            "Respond again with ONLY one JSON object (no markdown fences): " +
            '{"summary": string, "artifacts": [{"path": string, "language": string, "content": string, "kind": "file"}]}. ' +
            "Include repo paths such as frontend/package.json, frontend/src/App.tsx, backend/src/index.ts, README.md with complete file contents in each content field.";
          res = await invokeAgentCompletion(
            cfg ?? ({ GROQ_API_KEY: undefined } as AppConfig),
            agent,
            retryMsg,
            `${title}\n${objective}`,
            invokeSwarmOpts,
          );
          parsedArtifacts = parseArtifacts(res.reply);
        }

        // If the LLM fell back to mock (no API keys, or all providers failed), broadcast clearly
        // and skip artifact writes for code roles — mock prose is worse than nothing.
        const isMockResponse = res.provider === "mock";
        const codeRoles = new Set(["Development", "Coordination", "Design"]);
        if (isMockResponse && codeRoles.has(role)) {
          hub.broadcast(
            {
              type: "agent.activity",
              payload: {
                agent: agent.name,
                message: `[system:warn] ${role} got a mock response — no API key configured or all providers rate-limited. Set GROQ_API_KEY or OPENAI_API_KEY in .env to generate real code.`,
                ts: Date.now(),
              },
            },
            `mission:${id}`,
          );
          // Return with zero artifacts so the repair loop can try again next round.
          if (taskMeta) {
            const upd = await st.patchTask(taskMeta.id, { status: "failed" });
            if (upd) hub.broadcast({ type: "task.updated", payload: upd }, `mission:${id}`);
          }
          pushProgress(role, agent.name, res.reply.slice(0, 500), res.provider, res.model);
          return {
            role,
            agentId: agent.id,
            agentName: agent.name,
            specialization: agent.specialization,
            reply: res.reply,
            provider: res.provider,
            model: res.model,
            artifactPaths: [],
            error: "mock_response_skipped",
          };
        }

        if (res.llmFailure) {
          hub.broadcast(
            {
              type: "agent.activity",
              payload: {
                agent: agent.name,
                message: `[system:warn] ${role} LLM issue: ${res.llmFailure.slice(0, 280)}`,
                ts: Date.now(),
              },
            },
            `mission:${id}`,
          );
        }

        outputByRole.set(role, { agentName: agent.name, specialization: agent.specialization, reply: res.reply });

        // Persist artifacts for this wallet + mission.
        const parsed = parsedArtifacts ?? parseArtifacts(res.reply);
        // For code-generating roles: try to salvage partial artifacts from truncated JSON
        // before falling back to a notes dump that the verifier will flag as "notes-only".
        const partialArtifacts =
          codeRoles.has(role) && (!parsed?.artifacts || parsed.artifacts.length === 0)
            ? extractPartialArtifacts(res.reply)
            : null;
        const artifacts =
          parsed?.artifacts && parsed.artifacts.length > 0
            ? parsed.artifacts
            : partialArtifacts && partialArtifacts.length > 0
              ? partialArtifacts
              : [
                  {
                    path: `notes/${role}.md`,
                    language: "md",
                    content: codeRoles.has(role)
                      ? `<!-- JSON parse failed / response truncated — repair loop will regenerate -->\n${res.reply}`
                      : res.reply,
                    kind: "note" as const,
                  },
                ];
        for (const a of artifacts) {
          // Skip malformed double-extension paths (e.g. index.css.tsx) at persist time —
          // they corrupt both Sandpack and Vite, and the LLM keeps regenerating them otherwise.
          if (/\.(css|scss|sass|less|html|json|md|svg|png|jpe?g|gif|webp|ico)\.(tsx?|jsx?|mjs|cjs)$/i.test(a.path)) {
            continue;
          }
          await st.createMissionArtifact({
            missionId: id,
            wallet,
            agent: agent.name,
            role,
            kind: a.kind ?? "file",
            path: a.path,
            language: a.language,
            content: sanitizeViteApiUrlDoubleApi(a.path, typeof a.content === "string" ? a.content : ""),
          });
        }

        if (taskMeta) {
          const upd = await st.patchTask(taskMeta.id, { status: "done" });
          if (upd) hub.broadcast({ type: "task.updated", payload: upd }, `mission:${id}`);
        }

        hub.broadcast(
          {
            type: "agent.activity",
            payload: {
              agent: agent.name,
              message: `[done] ${role} · ${artifacts.length} artifact${artifacts.length === 1 ? "" : "s"} produced.`,
              ts: Date.now(),
            },
          },
          `mission:${id}`,
        );

        pushProgress(role, agent.name, res.reply.slice(0, 2000), res.provider, res.model);
        return {
          role,
          agentId: agent.id,
          agentName: agent.name,
          specialization: agent.specialization,
          reply: res.reply,
          provider: res.provider,
          model: res.model,
          artifactPaths: artifacts.map((a) => a.path),
          ...(res.llmFailure ? { debugLlm: res.llmFailure.slice(0, 800) } : {}),
        };
      } catch (e) {
        if (taskMeta) {
          const upd = await st.patchTask(taskMeta.id, { status: "failed" });
          if (upd) hub.broadcast({ type: "task.updated", payload: upd }, `mission:${id}`);
        }
        const reason = e instanceof Error ? e.message : String(e);
        hub.broadcast(
          { type: "agent.activity", payload: { agent: agent.name, message: `[swarm] ${role} failed: ${reason}`, ts: Date.now() } },
          `mission:${id}`,
        );
        pushProgress(role, agent.name, "", "mock", "error");
        return {
          role,
          agentId: agent.id,
          agentName: agent.name,
          specialization: agent.specialization,
          reply: "",
          provider: "mock" as const,
          model: "error",
          error: reason,
        };
      }
    };

    // Small sleep between Groq calls to avoid hitting TPM (tokens-per-minute) rate limits.
    const tpmPause = () => new Promise<void>((r) => setTimeout(r, 3500));

    const devPhase1Suffix = [
      "── PHASE 1 / 2 : FRONTEND CORE ──",
      "Generate ONLY these frontend/ files (keep each file ≤100 lines so the JSON stays compact):",
      "  frontend/package.json   (vite ^5.4, @vitejs/plugin-react ^4.3, tailwindcss, react ^18, react-dom ^18)",
      "  frontend/vite.config.ts",
      "  frontend/index.html",
      "  frontend/postcss.config.js",
      "  frontend/tailwind.config.js",
      "  frontend/src/main.tsx",
      "  frontend/src/App.tsx  ← put the COMPLETE app/game logic here",
      "No backend/ files and no README in this pass. Keep it short and runnable.",
    ].join("\n");

    const devPhase2Suffix = (phase1Paths: string[]) => [
      "── PHASE 2 / 2 : COMPONENTS + BACKEND + README ──",
      "Phase 1 already wrote:", ...phase1Paths.map((p) => `  ${p}`),
      "",
      "Now produce ONLY these files (ALL are required — do not skip any):",
      "  frontend/src/components/*.tsx  — extract heavy logic from App.tsx into 1-3 focused components",
      ...(needBackendStack
        ? [
            "  backend/package.json  — { name, version, scripts.start: 'node src/index.js', dependencies: { express } }",
            "  backend/src/index.ts  — Express HTTP API (≤80 lines) with the routes the frontend needs",
          ]
        : []),
      "  README.md  — REQUIRED: install + run instructions (≤30 lines). This file MUST be in your artifacts array.",
      "Do NOT re-generate frontend/package.json, frontend/vite.config, frontend/src/main.tsx, or frontend/src/App.tsx.",
    ].join("\n");

    // Sequenced execution: each role runs once, except Development which runs in two small phases
    // to stay within Groq's TPM limits (large single-pass JSON regularly exceeds 6K tokens/min).
    const results: Array<any> = [];
    let devPhase1Paths: string[] = [];
    for (const role of roles) {
      if (role === "Coordination") continue;
      if (role === "Development") {
        // Phase 1: frontend scaffold (small JSON ≈ 2K tokens out)
        const p1 = await runOne("Development", { artifactHeavy: false, userSuffix: devPhase1Suffix });
        results.push(p1);
        devPhase1Paths = Array.isArray(p1.artifactPaths) ? p1.artifactPaths : [];
        // Brief pause so TPM window partially resets before phase 2.
        await tpmPause();
        // Phase 2: components + backend + README (another small JSON ≈ 2K tokens out)
        const p2 = await runOne("Development", { artifactHeavy: false, userSuffix: devPhase2Suffix(devPhase1Paths) });
        results.push(p2);
        await tpmPause();
      } else {
        results.push(await runOne(role));
        // Pace Groq calls for non-code roles too.
        await tpmPause();
      }
    }
    // Always run Coordination last for final synthesis.
    const coordRole = configuredRoles.includes("Coordination") ? "Coordination" : "Strategy";
    const final = await runOne(coordRole === "Strategy" ? "Coordination" : "Coordination");
    results.push(final);

    // ── Structural Guarantor ─────────────────────────────────────────────────
    // Deterministically inject files that the LLM routinely omits (README.md,
    // backend/package.json, backend/tsconfig.json). No LLM call — pure code.
    // Runs after ALL agents so it sees the complete artifact set.
    // Only writes a file when it is genuinely missing; never overwrites LLM output.
    {
      const allArts = await st.listMissionArtifacts(wallet, id);
      const byPath = new Map<string, (typeof allArts)[number]>();
      for (const a of allArts) {
        const prev = byPath.get(a.path);
        if (!prev || a.createdAt > prev.createdAt) byPath.set(a.path, a);
      }
      const lowerPaths = [...byPath.keys()].map((p) => p.toLowerCase());
      const hasFrontend = lowerPaths.some((p) => p.startsWith("frontend/"));
      const hasBackendFiles = lowerPaths.some((p) => p.startsWith("backend/") || p.startsWith("server/") || p.startsWith("api/"));
      const hasBackendPkg = lowerPaths.some((p) => p === "backend/package.json");
      const hasTsBackend = lowerPaths.some(
        (p) => (p.startsWith("backend/") || p.startsWith("server/")) && p.endsWith(".ts") && !p.endsWith(".d.ts"),
      );
      const hasReadme = lowerPaths.some((p) => p === "readme.md" || p.endsWith("/readme.md"));
      const saveGuaranteed = async (path: string, language: string, content: string) => {
        await st.createMissionArtifact({
          missionId: id, wallet,
          agent: "HiveMind", role: "Structural Guarantor",
          kind: "file", path, language, content,
        });
        hub.broadcast(
          { type: "agent.activity", payload: { agent: "HiveMind", message: `[guarantor] injected missing ${path}`, ts: Date.now() } },
          `mission:${id}`,
        );
      };

      // 1. backend/package.json — always needed if any backend/* files exist
      if (hasBackendFiles && !hasBackendPkg) {
        const backendEntryTs = lowerPaths.find((p) => p.startsWith("backend/src/") && p.endsWith(".ts") && !p.endsWith(".d.ts"));
        const backendEntry = backendEntryTs ? backendEntryTs.replace(/^backend\//, "") : "src/index.js";
        const startScript = hasTsBackend
          ? `node -r ts-node/register ${backendEntry}`
          : `node ${backendEntry.replace(/\.ts$/, ".js")}`;
        const backendPkg = {
          name: "hivemind-backend",
          version: "1.0.0",
          scripts: {
            start: startScript,
            dev: hasTsBackend ? `ts-node ${backendEntry}` : `node ${backendEntry}`,
            build: hasTsBackend ? "tsc" : "echo ok",
          },
          dependencies: {
            express: "^4.19.2",
            cors: "^2.8.5",
            ...(hasTsBackend ? { "ts-node": "^10.9.2", typescript: "^5.4.5" } : {}),
          },
          devDependencies: hasTsBackend
            ? { "@types/express": "^4.17.21", "@types/cors": "^2.8.17", "@types/node": "^20.14.0" }
            : {},
        };
        await saveGuaranteed("backend/package.json", "json", JSON.stringify(backendPkg, null, 2));

        // Also inject backend tsconfig.json for TypeScript backends (skips strict lib checks)
        if (hasTsBackend) {
          const tsc = {
            compilerOptions: {
              target: "ES2020", module: "commonjs", rootDir: "src", outDir: "dist",
              esModuleInterop: true, skipLibCheck: true, strict: false, resolveJsonModule: true,
            },
            include: ["src/**/*"],
          };
          const hasBeTsConfig = lowerPaths.some((p) => p === "backend/tsconfig.json");
          if (!hasBeTsConfig) {
            await saveGuaranteed("backend/tsconfig.json", "json", JSON.stringify(tsc, null, 2));
          }
        }
      }

      // 2. README.md — always required
      if (!hasReadme && hasFrontend) {
        const readmeLines = [
          `# ${title}`,
          "",
          "> Generated by HiveMind autonomous agent swarm.",
          "",
          "## Quick start",
          "",
          "### Frontend",
          "```bash",
          "cd frontend",
          "npm install",
          "npm run dev",
          "```",
          ...(hasBackendFiles
            ? [
                "",
                "### Backend",
                "```bash",
                "cd backend",
                "npm install",
                hasTsBackend ? "npm run dev   # ts-node" : "npm start",
                "```",
              ]
            : []),
          "",
          "## Deployment",
          "Run `npm run build` in `frontend/` — output goes to `frontend/dist/`.",
          hasTsBackend ? "Backend: `npm run build` compiles TypeScript to `dist/`." : "",
        ]
          .filter((l) => l !== undefined)
          .join("\n");
        await saveGuaranteed("README.md", "md", readmeLines.trim() + "\n");
      }
    }
    // ── end Structural Guarantor ─────────────────────────────────────────────

    const elapsedMs = Date.now() - startedAt;
    const etaLabel =
      elapsedMs < 1000
        ? `${elapsedMs}ms`
        : elapsedMs < 60_000
          ? `${(elapsedMs / 1000).toFixed(1)}s`
          : `${Math.round(elapsedMs / 60_000)}m ${Math.round((elapsedMs % 60_000) / 1000)}s`;

    let updatedMission: Mission | undefined;
    if (m) {
      updatedMission = await st.patchMission(id, { eta: etaLabel });
      if (updatedMission) {
        hub.broadcast({ type: "mission.updated", payload: updatedMission }, `mission:${id}`);
        hub.broadcast({ type: "mission.updated", payload: updatedMission }, "global");
      }
    }

    // Verifier pass — checks the deliverables actually exist before we say "complete".
    const listDedupedPaths = async () => {
      const all = await st.listMissionArtifacts(wallet, id);
      const byPath = new Map<string, (typeof all)[number]>();
      for (const a of all) {
        const prev = byPath.get(a.path);
        if (!prev || a.createdAt > prev.createdAt) byPath.set(a.path, a);
      }
      return [...byPath.keys()];
    };

    const loadArtifactContentMap = async () => {
      const all = await st.listMissionArtifacts(wallet, id);
      const byPath = new Map<string, (typeof all)[number]>();
      for (const a of all) {
        const prev = byPath.get(a.path);
        if (!prev || a.createdAt > prev.createdAt) byPath.set(a.path, a);
      }
      return new Map<string, string>([...byPath.entries()].map(([path, meta]) => [path, meta.content]));
    };

    let dedupedPaths = await listDedupedPaths();
    let contentByPath = await loadArtifactContentMap();
    const hasFrontendTree = (paths: string[]) =>
      paths.some((p) => p.replace(/\\/g, "/").toLowerCase().startsWith("frontend/"));

    const runCritiquePass = async (): Promise<string> => {
      const agentCoord = pickAgent("Coordination");
      const briefText = typeof brief === "string" ? brief : JSON.stringify(brief, null, 2);
      const userMsg = [
        `Mission title: ${title}`,
        `Mission objective: ${objective}`,
        "## Canonical mission brief\n" + briefText.slice(0, 5200),
        "",
        `## Artifact paths (${dedupedPaths.length})\n${dedupedPaths.slice(0, 180).join("\n")}`,
        "",
        "You are a rigorous UI+engineering reviewer for a Vite+React codebase. Output 6–16 bullet gaps vs the brief: layout/sections missing, typography, Tailwind/CSS depth, responsiveness, accessibility, routing, bogus placeholders. Plain text bullets only — no JSON or code fences.",
      ].join("\n");
      hub.broadcast(
        {
          type: "agent.activity",
          payload: {
            agent: agentCoord.name,
            message: "[critique] running automated review…",
            ts: Date.now(),
          },
        },
        `mission:${id}`,
      );
      const res = await invokeAgentCompletion(
        cfg ?? ({ GROQ_API_KEY: undefined } as AppConfig),
        agentCoord,
        userMsg,
        `${title}\n${objective}`,
        {},
      );
      hub.broadcast(
        {
          type: "agent.activity",
          payload: { agent: agentCoord.name, message: res.reply.slice(0, 640), ts: Date.now() },
        },
        `mission:${id}`,
      );
      return res.reply.trim().slice(0, 6000);
    };

    const critiqueNotes =
      hasFrontendTree(dedupedPaths)
        ? await runCritiquePass().catch((e) => {
            hub.broadcast(
              {
                type: "agent.activity",
                payload: {
                  agent: "HiveMind",
                  message: `[critique] skipped: ${String(e instanceof Error ? e.message : e).slice(0, 280)}`,
                  ts: Date.now(),
                },
              },
              `mission:${id}`,
            );
            return "";
          })
        : "";

    const toPreviewArtifacts = () => [...contentByPath.entries()].map(([path, content]) => ({ path, content }));

    let buildDiag =
      hasFrontendTree(dedupedPaths)
        ? await previewManager().diagnoseArtifactBuild(toPreviewArtifacts())
        : { ok: true, log: "(no frontend/ artifacts — skipped build diagnose)" };

    let verification = verifySwarmDeliverables(dedupedPaths, contentByPath, title, objective);

    // Default 5 repair rounds; env override for tuning.
    const maxRepair =
      typeof cfg?.SWARM_BUILD_REPAIR_MAX_ROUNDS === "number" && cfg.SWARM_BUILD_REPAIR_MAX_ROUNDS > 0
        ? cfg.SWARM_BUILD_REPAIR_MAX_ROUNDS
        : Math.min(10, Number(process.env.SWARM_BUILD_REPAIR_MAX_ROUNDS ?? 5) || 5);

    /** Save patched files from auto-heal back into the artifact DB so subsequent rounds inherit them. */
    const persistPatchedFiles = async (patchedFiles: Array<{ path: string; content: string }>) => {
      for (const pf of patchedFiles) {
        await st.createMissionArtifact({
          missionId: id, wallet,
          agent: "HiveMind", role: "Auto-Heal",
          kind: "file", path: pf.path, language: pf.path.endsWith(".json") ? "json" : "typescript",
          content: pf.content,
        });
      }
    };

    // Persist any auto-healed files from the initial diagnostic build.
    if (buildDiag.patchedFiles && buildDiag.patchedFiles.length > 0) {
      await persistPatchedFiles(buildDiag.patchedFiles);
      dedupedPaths = await listDedupedPaths();
      contentByPath = await loadArtifactContentMap();
    }

    let lastBuildErrorSignature = "";
    let stuckCount = 0;
    let repairRound = 0;
    while (repairRound < maxRepair && (!verification.ok || (!buildDiag.ok && hasFrontendTree(dedupedPaths)))) {
      repairRound += 1;
      const buildFailing = !buildDiag.ok && hasFrontendTree(dedupedPaths);
      hub.broadcast(
        {
          type: "agent.activity",
          payload: {
            agent: "HiveMind",
            message: `[swarm] repair ${repairRound}/${maxRepair} · verify:${verification.ok ? "✓" : "✗"} · build:${buildDiag.ok ? "✓" : "✗"}`,
            ts: Date.now(),
          },
        },
        `mission:${id}`,
      );

      // ── Parse the build log to generate a surgical agent prompt ──────────
      const parsed = buildFailing ? parseBuildLog(buildDiag.log) : null;
      // Detect if we're stuck on the same error (stop burning rounds with identical prompts)
      const errorSig = parsed ? parsed.errorBlocks.slice(0, 2).join("|").slice(0, 200) : "";
      if (errorSig && errorSig === lastBuildErrorSignature) {
        stuckCount++;
      } else {
        stuckCount = 0;
        lastBuildErrorSignature = errorSig;
      }
      // If stuck on same error for 2 rounds: try nuclear — rewrite the whole App.tsx + package.json.
      const nuclearRepair = stuckCount >= 2;

      const repairSuffix = buildFailing && parsed
        ? [
            "---",
            `REPAIR PASS ${repairRound} — The Vite build is failing. ${nuclearRepair ? "Full rewrite required." : "Make the MINIMUM change to fix the error."}`,
            "",
            parsed.surgicalPrompt,
            "",
            ...(repairRound === 1 && critiqueNotes
              ? ["### Additional quality feedback (address only if build passes first)", critiqueNotes.slice(0, 1000)]
              : []),
            ...(nuclearRepair
              ? [
                  "### NUCLEAR REPAIR: previous targeted fixes did not resolve the error.",
                  "Rewrite frontend/src/App.tsx from scratch — simpler implementation, fewer dependencies.",
                  "Rewrite frontend/package.json — only include packages you ACTUALLY use in the code.",
                ]
              : []),
          ].join("\n")
        : [
            "---",
            `REPAIR PASS ${repairRound} — Fix all issues below. Return STRICT JSON with complete file bodies.`,
            ...verification.issues.map((i) => `- ${i.slice(0, 300)}`),
            "",
            repairRound === 1 && critiqueNotes ? `### Critique\n${critiqueNotes.slice(0, 800)}` : "",
            missionRequiresBackend(title, objective)
              ? "Include frontend/, backend/, README.md. Keep each file ≤120 lines."
              : "Include frontend/ files only. Keep each file ≤120 lines.",
          ].filter(Boolean).join("\n");

      hub.broadcast(
        {
          type: "agent.activity",
          payload: {
            agent: "Development",
            message: `[repair:${repairRound}] ${parsed ? `error type: ${parsed.errorType} · ${parsed.missingPackages.length > 0 ? `missing packages: [${parsed.missingPackages.join(", ")}]` : `files: [${parsed.filesWithErrors.join(", ")}]`}` : "fixing verification issues"}`,
            ts: Date.now(),
          },
        },
        `mission:${id}`,
      );

      await tpmPause();
      results.push(await runOne("Development", { artifactHeavy: false, userSuffix: repairSuffix }));
      await tpmPause();

      // Re-run Structural Guarantor after each repair round to keep README/backend intact.
      {
        const artsAfterRepair = await st.listMissionArtifacts(wallet, id);
        const byPathR = new Map<string, (typeof artsAfterRepair)[number]>();
        for (const a of artsAfterRepair) {
          const prev = byPathR.get(a.path);
          if (!prev || a.createdAt > prev.createdAt) byPathR.set(a.path, a);
        }
        const lp = [...byPathR.keys()].map((p) => p.toLowerCase());
        const hasBeFiles = lp.some((p) => p.startsWith("backend/") || p.startsWith("server/") || p.startsWith("api/"));
        const hasBePkg = lp.some((p) => p === "backend/package.json");
        const hasTsBe = lp.some((p) => (p.startsWith("backend/") || p.startsWith("server/")) && p.endsWith(".ts") && !p.endsWith(".d.ts"));
        const hasRm = lp.some((p) => p === "readme.md" || p.endsWith("/readme.md"));
        const hasFe = lp.some((p) => p.startsWith("frontend/"));
        const saveG = async (path: string, language: string, content: string) => {
          await st.createMissionArtifact({ missionId: id, wallet, agent: "HiveMind", role: "Structural Guarantor", kind: "file", path, language, content });
        };
        if (hasBeFiles && !hasBePkg) {
          const bePkg = { name: "hivemind-backend", version: "1.0.0", scripts: { start: hasTsBe ? "node -r ts-node/register src/index.ts" : "node src/index.js", dev: hasTsBe ? "ts-node src/index.ts" : "node src/index.js", build: hasTsBe ? "tsc" : "echo ok" }, dependencies: { express: "^4.19.2", cors: "^2.8.5", ...(hasTsBe ? { "ts-node": "^10.9.2", typescript: "^5.4.5" } : {}) }, devDependencies: hasTsBe ? { "@types/express": "^4.17.21", "@types/cors": "^2.8.17", "@types/node": "^20.14.0" } : {} };
          await saveG("backend/package.json", "json", JSON.stringify(bePkg, null, 2));
        }
        if (!hasRm && hasFe) {
          await saveG("README.md", "md", `# ${title}\n\n> Generated by HiveMind.\n\n## Quick start\n\`\`\`bash\ncd frontend && npm install && npm run dev\n\`\`\`\n`);
        }
      }

      dedupedPaths = await listDedupedPaths();
      contentByPath = await loadArtifactContentMap();
      buildDiag = hasFrontendTree(dedupedPaths)
        ? await previewManager().diagnoseArtifactBuild(toPreviewArtifacts())
        : { ok: true, log: "(no frontend tree yet)" };
      // Persist any new auto-heal patches back to DB.
      if (buildDiag.patchedFiles && buildDiag.patchedFiles.length > 0) {
        await persistPatchedFiles(buildDiag.patchedFiles);
        dedupedPaths = await listDedupedPaths();
        contentByPath = await loadArtifactContentMap();
      }
      verification = verifySwarmDeliverables(dedupedPaths, contentByPath, title, objective);

      hub.broadcast(
        {
          type: "agent.activity",
          payload: {
            agent: "Verifier",
            message: `[repair:${repairRound}] build:${buildDiag.ok ? "✓ PASS" : "✗ still failing"} · verify:${verification.ok ? "✓ clean" : `✗ ${verification.issues.length} issue(s)`}`,
            ts: Date.now(),
          },
        },
        `mission:${id}`,
      );
    }

    if (!buildDiag.ok && hasFrontendTree(dedupedPaths)) {
      const nextIssues = [
        ...verification.issues,
        `Frontend Vite build failed after ${repairRound} repair round(s) — see agent activity for build log.`,
      ];
      verification = {
        ...verification,
        ok: false,
        issues: nextIssues,
        summary: `Verification flagged ${nextIssues.length} issue(s) (includes frontend build).`,
      };
    }

    const fileTree = buildArtifactTreeText(dedupedPaths);

    await appendSwarmQualityLog({
      missionId: id,
      critiqueChars: critiqueNotes.length,
      repairRounds: repairRound,
      verificationOk: verification.ok,
      buildDiagOk: buildDiag.ok,
      pathCount: dedupedPaths.length,
    }).catch(() => {});

    hub.broadcast(
      {
        type: "agent.activity",
        payload: {
          agent: "Verifier",
          message: `[verify] ${verification.summary}${buildDiag.ok ? "" : " · frontend build still failing after repair loop"}`,
          ts: Date.now(),
        },
      },
      `mission:${id}`,
    );
    if (!verification.ok || !buildDiag.ok) {
      const combined = [...verification.issues.slice(0, 5)];
      if (!buildDiag.ok) combined.push("(see build logs in swarm repair activity)");
      for (const issue of combined) {
        hub.broadcast(
          {
            type: "agent.activity",
            payload: { agent: "Verifier", message: `[verify:issue] ${issue}`, ts: Date.now() },
          },
          `mission:${id}`,
        );
      }
    }

    hub.broadcast(
      {
        type: "agent.activity",
        payload: {
          agent: "HiveMind",
          message:
            verification.ok && buildDiag.ok
              ? `[system:done] Mission complete in ${etaLabel} · ${dedupedPaths.length} files shipped · preview build passing`
              : `[system:warn] Mission finished in ${etaLabel} · some issues remain — check verification output above`,
          ts: Date.now(),
        },
      },
      `mission:${id}`,
    );

    const coordRaw = outputByRole.get("Coordination")?.reply ?? "";
    const coordParsed = parseArtifacts(coordRaw);
    const finalReply = coordParsed?.summary ?? coordRaw;
    swarmJobs.set(jobId, {
      status: "done",
      missionId: id,
      wallet,
      startedAt: jobStartedAt,
      data: {
        persisted: Boolean(m),
        etaLabel,
        startedAt,
        finishedAt: Date.now(),
        results,
        finalReply,
        verification,
        fileTree,
        artifactPaths: dedupedPaths,
        mission: updatedMission ?? null,
      },
    });
    } catch (swarmErr) {
      const errMsg = swarmErr instanceof Error ? swarmErr.message : String(swarmErr);
      swarmJobs.set(jobId, { status: "failed", missionId: id, wallet, error: errMsg, startedAt: jobStartedAt });
    }
    })(); // end background IIFE
  }); // end swarm-run POST route

  /** GET /api/missions/:id/swarm-status/:jobId — poll until status !== "running". */
  app.get("/api/missions/:id/swarm-status/:jobId", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const { id, jobId: jid } = req.params as { id: string; jobId: string };
    const job = swarmJobs.get(jid);
    if (!job) return reply.status(404).send({ error: "not_found", message: "Job not found or already expired." });
    if (job.missionId !== id || job.wallet !== wallet) return reply.status(403).send({ error: "forbidden" });
    return { status: job.status, data: job.data ?? null, error: job.error ?? null, progress: job.progress ?? null };
  });

  app.get("/api/missions/:id", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const id = (req.params as { id: string }).id;
    const m = await hivemindStore().getMission(id);
    if (!m) return reply.status(404).send({ error: "not_found" });
    // Per-wallet scoping: a different wallet shouldn't see this mission's title/objective by id.
    const owner = (m as typeof m & { wallet?: string }).wallet;
    if (owner && owner !== wallet) return reply.status(404).send({ error: "not_found" });
    return m;
  });

  app.post("/api/missions", async (req, reply) => {
    let wallet: string;
    try {
      wallet = requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const parsed = createMission.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    // Tag the mission with the creator's wallet so listMissions can filter — otherwise
    // every wallet sees every mission ever created (cross-tenant data leak).
    const m = await hivemindStore().createMission({ ...parsed.data, wallet });
    hub.broadcast({ type: "mission.created", payload: m }, `mission:${m.id}`);
    hub.broadcast({ type: "mission.created", payload: m }, "global");
    return m;
  });

  app.patch("/api/missions/:id", async (req, reply) => {
    try {
      requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const id = (req.params as { id: string }).id;
    const parsed = patchMission.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    const m = await hivemindStore().patchMission(id, parsed.data);
    if (!m) return reply.status(404).send({ error: "not_found" });
    hub.broadcast({ type: "mission.updated", payload: m }, `mission:${id}`);
    hub.broadcast({ type: "mission.updated", payload: m }, "global");
    return m;
  });

  app.delete("/api/missions/:id", async (req, reply) => {
    try {
      requireWallet(req);
    } catch (e) {
      const err = e as { statusCode?: number };
      return reply.status(err.statusCode ?? 401).send({ error: "unauthorized" });
    }
    const id = (req.params as { id: string }).id;
    const ok = await hivemindStore().deleteMission(id);
    if (!ok) return reply.status(404).send({ error: "not_found" });
    hub.broadcast({ type: "mission.deleted", payload: { id } }, "global");
    return { ok: true };
  });

  /**
   * POST /api/missions/suggest
   * AI-generates deliverables and success metrics from a mission objective.
   * No auth required — read-only, no data written.
   */
  app.post("/api/missions/suggest", async (req, reply) => {
    const body = req.body as { objective?: string; priority?: string } | undefined;
    const objective = (body?.objective ?? "").trim().slice(0, 500);
    const priority = ((body?.priority ?? "std") as string) as MissionPriority;
    if (!objective) return reply.status(400).send({ error: "objective_required" });

    const agents = await hivemindStore().listAgents();
    const agent =
      agents.find((a) => a.specialization === "Strategy") ??
      agents.find((a) => a.specialization === "Coordination") ??
      agents[0];
    if (!agent) return reply.status(503).send({ error: "no_agents" });

    const prompt = [
      "Generate mission deliverables and success metrics for the following objective.",
      "Return STRICT JSON only (no markdown, no text outside JSON):",
      '{"deliverables": ["...", "..."], "metrics": [{"label": "...", "target": "..."}, ...]}',
      "Rules:",
      "- deliverables: 3-5 concrete, actionable items specific to the mission domain",
      "- metrics: 3-4 measurable success criteria with quantified targets where possible",
      "- Match the domain exactly (e.g. DeFi mission → DeFi-specific deliverables, not generic ones)",
      "- No generic boilerplate — everything must be specific to this objective",
      "",
      `Objective: ${objective}`,
      `Priority: ${priority}`,
    ].join("\n");

    try {
      const result = await invokeAgentCompletion(
        cfg ?? ({ GROQ_API_KEY: undefined } as AppConfig),
        agent,
        prompt,
        objective,
        { priority },
      );
      const parsed = safeJsonParse(result.reply);
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        const deliverables = Array.isArray(obj.deliverables)
          ? (obj.deliverables as unknown[])
              .filter((d): d is string => typeof d === "string")
              .slice(0, 5)
          : [];
        const metrics = Array.isArray(obj.metrics)
          ? (obj.metrics as unknown[])
              .filter(
                (m): m is { label: string; target: string } =>
                  Boolean(m && typeof (m as any).label === "string" && typeof (m as any).target === "string"),
              )
              .slice(0, 4)
          : [];
        if (deliverables.length > 0 || metrics.length > 0) {
          return reply.send({ deliverables, metrics });
        }
      }
      return reply.send({
        deliverables: ["Working prototype", "Documentation", "Deployment guide"],
        metrics: [
          { label: "Completion", target: "100%" },
          { label: "Quality Score", target: "≥ 0.85" },
        ],
      });
    } catch (e) {
      console.warn("[hivemind] suggest failed:", e);
      return reply.status(500).send({ error: "suggest_failed" });
    }
  });
}
