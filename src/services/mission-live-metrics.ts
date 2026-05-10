import type { AgentProfile, Mission, MissionLiveMetrics, Task } from "../types/domain";

const MINUTES_PER_REMAINING_TASK = 15;

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function formatEtaMinutes(totalMin: number): string {
  if (totalMin <= 0) return "Due now";
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function parseDeadline(iso: string | null | undefined): Date | null {
  if (!iso || typeof iso !== "string" || !iso.trim()) return null;
  const d = new Date(iso.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ETA written by auto-invoke (wall-clock for the LLM turn). */
function isMeasuredLatencyEta(eta: string): boolean {
  const t = eta.trim();
  return (
    /^\d+ms$/i.test(t) ||
    /^\d+(\.\d+)?s$/i.test(t) ||
    /^\d+m\s+\d+s$/i.test(t)
  );
}

/** Wizard / template strings like "4h 20m", "02h 14m" — not a real-time estimate. */
function isWizardStyleEta(eta: string): boolean {
  const t = eta.trim();
  if (t === "—" || !t) return false;
  if (isMeasuredLatencyEta(t)) return false;
  return /\d+\s*h/i.test(t) && /\d+\s*m/i.test(t);
}

export function computeMissionLiveMetrics(
  mission: Mission,
  tasks: Task[],
  agents: AgentProfile[],
): MissionLiveMetrics {
  const rosterTotal = mission.agents.length;
  const specs = new Set(agents.map((a) => a.specialization));
  const rosterBacked = mission.agents.filter((role) => specs.has(role)).length;

  let progressPct: number;
  let opsDone = 0;
  const opsTotal = tasks.length;

  if (tasks.length > 0) {
    opsDone = tasks.filter((t) => t.status === "done").length;
    progressPct = clampPct((opsDone / tasks.length) * 100);
  } else {
    progressPct = clampPct(mission.progress);
  }

  let etaLabel = "—";
  let etaSource: MissionLiveMetrics["etaSource"] = "none";

  const rawEta = mission.eta?.trim() ?? "";

  // Task-based estimate when work is still queued/active.
  if (tasks.length > 0) {
    const remaining = tasks.filter((t) => t.status !== "done").length;
    if (remaining === 0) {
      // All tasks done: prefer measured invoke latency over generic "Complete".
      if (rawEta && isMeasuredLatencyEta(rawEta)) {
        etaLabel = rawEta;
        etaSource = "stored";
      } else {
        etaLabel = "Complete";
        etaSource = "task_estimate";
      }
    } else {
      const estimateMin = remaining * MINUTES_PER_REMAINING_TASK;
      etaLabel = formatEtaMinutes(estimateMin);
      etaSource = "task_estimate";
    }
  } else if (rawEta && rawEta !== "—") {
    if (isMeasuredLatencyEta(rawEta)) {
      etaLabel = rawEta;
      etaSource = "stored";
    } else if (isWizardStyleEta(rawEta)) {
      // Don't surface template wizard ETAs as if they were real.
      etaLabel = "—";
      etaSource = "none";
    } else {
      etaLabel = rawEta;
      etaSource = "stored";
    }
  } else {
    // Nothing measured yet — show "—" rather than the raw deadline countdown,
    // which is often many hours and is misleading before any agent has run.
    const deadline = parseDeadline(mission.config?.deadlineIso ?? null);
    if (deadline) {
      const diffMin = Math.ceil((deadline.getTime() - Date.now()) / 60_000);
      if (diffMin <= 0) {
        etaLabel = "Past deadline";
      } else if (progressPct > 0) {
        // Only surface deadline countdown once there's measurable progress.
        etaLabel = formatEtaMinutes(diffMin);
      }
      etaSource = "deadline";
    }
  }

  return {
    rosterBacked,
    rosterTotal,
    progressPct,
    opsDone,
    opsTotal,
    etaLabel,
    etaSource,
  };
}
