import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/** Append one JSON line for future preference tuning / dashboards (set SWARM_QUALITY_LOG=true). */
export async function appendSwarmQualityLog(entry: Record<string, unknown>): Promise<void> {
  if (String(process.env.SWARM_QUALITY_LOG ?? "").trim().toLowerCase() !== "true") return;
  const dir = path.resolve(process.cwd(), ".hivemind-logs");
  await mkdir(dir, { recursive: true }).catch(() => {});
  const fp = path.join(dir, "swarm-quality.jsonl");
  const line =
    JSON.stringify({
      ts: Date.now(),
      ...entry,
    }) + "\n";
  await appendFile(fp, line, "utf8").catch(() => {});
}
