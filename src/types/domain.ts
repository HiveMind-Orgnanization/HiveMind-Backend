export type MissionStatus = "active" | "queued" | "completed";

export type MissionSuccessMetric = { label: string; target: string };

/** Budget split (fractions of mission budget); should sum to ~1. */
export type MissionBudgetAllocation = {
  agentCompute: number;
  tokenUsage: number;
  escrowReserve: number;
  settlementBuffer: number;
};

/** Full wizard state persisted with each mission. */
export type MissionConfig = {
  priorityKey: string;
  deliverables: string[];
  successMetrics: MissionSuccessMetric[];
  /** ISO 8601 datetime string when the mission should complete. */
  deadlineIso: string | null;
  delegationPct: number;
  executionSpeedPct: number;
  collaborationPct: number;
  autoApproveSubtasks: boolean;
  sharedCrossAgentMemory: boolean;
  autoOnChainSettlement: boolean;
  budgetAllocation: MissionBudgetAllocation;
  /** Agent-generated expanded spec / PRD used as canonical mission context. */
  brief?: unknown;
  briefUpdatedAt?: number;
};

export type Mission = {
  id: string;
  title: string;
  objective: string;
  priority: string;
  status: MissionStatus;
  agents: string[];
  budget: number;
  cost: number;
  progress: number;
  createdAt: number;
  eta: string;
  confidence: number;
  config?: MissionConfig;
};

/** Derived dashboard stats from missions + tasks + agent registry (single API source of truth). */
export type MissionLiveMetrics = {
  rosterBacked: number;
  rosterTotal: number;
  /** 0–100; from task completion when tasks exist, else persisted mission.progress */
  progressPct: number;
  opsDone: number;
  opsTotal: number;
  etaLabel: string;
  etaSource: "deadline" | "task_estimate" | "stored" | "none";
};

export type AgentProfile = {
  id: string;
  name: string;
  specialization: string;
  model: string;
  reputation: number;
  missionsCompleted: number;
  trustScore: number;
  walletPubkey?: string;
};

export type Task = {
  id: string;
  missionId: string;
  title: string;
  agent: string;
  status: "queued" | "active" | "done" | "failed";
  stage?: string;
  createdAt: number;
};

export type PaymentIntent = {
  id: string;
  missionId: string;
  amountSol: number;
  recipientPubkey: string;
  status: "pending" | "submitted" | "confirmed";
  createdAt: number;
};

export type MemoryChunk = {
  id: string;
  missionId?: string;
  text: string;
  embeddingDims: number;
  score?: number;
};

export type AuthChallenge = {
  wallet: string;
  nonce: string;
  message: string;
  expiresAt: number;
};

export type MissionArtifact = {
  id: string;
  missionId: string;
  /** Wallet that produced/owns the artifact. */
  wallet: string;
  agent: string;
  role: string;
  path: string;
  language?: string;
  content: string;
  kind: "file" | "note";
  createdAt: number;
};
