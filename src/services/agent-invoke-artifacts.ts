import { z } from "zod";
import type { MissionArtifact } from "../types/domain";

/** Newest row per logical path for preview / prompts. */
export function latestArtifactsByPath(rows: MissionArtifact[]): Array<{ path: string; content: string }> {
  const byPath = new Map<string, MissionArtifact>();
  for (const a of rows) {
    const prev = byPath.get(a.path);
    if (!prev || a.createdAt > prev.createdAt) byPath.set(a.path, a);
  }
  return [...byPath.values()]
    .sort((x, y) => x.path.localeCompare(y.path))
    .map((a) => ({ path: a.path, content: a.content ?? "" }));
}

const ALLOWED_PREFIX =
  /^(frontend\/|backend\/|server\/|api\/|docs\/|design\/|notes\/)/i;

export function isAllowedMissionArtifactPath(rel: string): boolean {
  const n = rel.replace(/\\/g, "/").trim().replace(/^\/+/, "");
  if (!n.length) return false;
  const parts = n.split("/");
  if (parts.some((s) => s === "..")) return false;
  return ALLOWED_PREFIX.test(n);
}

export function buildArtifactContextUserBlock(
  files: Array<{ path: string; content: string }>,
  opts?: { maxTotalChars?: number; maxFileChars?: number },
): string {
  const maxTotal = opts?.maxTotalChars ?? 14_000;
  const maxFile = opts?.maxFileChars ?? 12_000;
  if (files.length === 0) return "";
  const head: string[] = [
    "## Latest mission artifacts (context: current saved files; newest version per path)",
    "",
    "### Paths",
    ...files.map((f) => `- ${f.path}`),
    "",
    "### Contents",
  ];
  const out: string[] = [...head];
  let used = out.join("\n").length;
  for (const f of files) {
    let body = f.content;
    if (body.length > maxFile) body = `${body.slice(0, maxFile)}\n\n…[truncated]…`;
    const section = `\n#### ${f.path}\n\`\`\`\n${body}\n\`\`\`\n`;
    if (used + section.length > maxTotal) {
      out.push("\n…[further files omitted for size — name a path if you need the full body]…");
      break;
    }
    out.push(section);
    used += section.length;
  }
  return out.join("\n");
}

const persistSchema = z.object({
  assistantReply: z.string(),
  fileUpdates: z
    .array(
      z.object({
        path: z.string(),
        language: z.string().optional(),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export type ParsedPersistReply =
  | { ok: true; data: z.infer<typeof persistSchema> }
  | { ok: false; error?: string };

export function stripMarkdownFence(s: string): string {
  const t = s.trim();
  const m = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m.exec(t);
  if (m) return m[1]!.trim();
  return t;
}

export function parsePersistArtifactReply(raw: string): ParsedPersistReply {
  try {
    const j = JSON.parse(stripMarkdownFence(raw)) as unknown;
    const r = persistSchema.safeParse(j);
    if (!r.success) return { ok: false, error: "schema" };
    return { ok: true, data: r.data };
  } catch {
    return { ok: false, error: "json" };
  }
}

export function languageFromArtifactPath(rel: string): string | undefined {
  const p = rel.replace(/\\/g, "/").toLowerCase();
  const ext = p.includes(".") ? (p.split(".").pop() ?? "") : "";
  const map: Record<string, string> = {
    tsx: "tsx",
    ts: "ts",
    jsx: "jsx",
    js: "js",
    json: "json",
    md: "md",
    css: "css",
    html: "html",
    vue: "vue",
    svelte: "svelte",
  };
  return map[ext];
}
