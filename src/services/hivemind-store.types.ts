import type {
  AgentProfile,
  AuthChallenge,
  MemoryChunk,
  MissionArtifact,
  Mission,
  PaymentIntent,
  Task,
} from "../types/domain";

/** Persistence layer for HiveMind API routes (memory or PostgreSQL). */
export interface HiveMindStore {
  close(): Promise<void>;

  createChallenge(wallet: string): Promise<AuthChallenge>;
  consumeChallenge(wallet: string): Promise<AuthChallenge | undefined>;

  listMissions(): Promise<Mission[]>;
  getMission(id: string): Promise<Mission | undefined>;
  createMission(input: Omit<Mission, "id" | "createdAt">): Promise<Mission>;
  patchMission(id: string, patch: Partial<Mission>): Promise<Mission | undefined>;
  deleteMission(id: string): Promise<boolean>;

  listAgents(): Promise<AgentProfile[]>;
  getAgent(id: string): Promise<AgentProfile | undefined>;

  listTasks(missionId?: string): Promise<Task[]>;
  createTask(input: Omit<Task, "id" | "createdAt">): Promise<Task>;
  patchTask(id: string, patch: Partial<Task>): Promise<Task | undefined>;

  listPayments(missionId?: string): Promise<PaymentIntent[]>;
  createPaymentIntent(input: Omit<PaymentIntent, "id" | "createdAt" | "status">): Promise<PaymentIntent>;

  searchMemory(query: string, topK: number): Promise<MemoryChunk[]>;
  listMemoryChunks(): Promise<MemoryChunk[]>;

  /** Per-wallet Agent Workspace UI snapshot (syncs across devices when signed in). */
  getMissionWorkspaceSnapshot(
    wallet: string,
    missionId: string,
  ): Promise<{ payload: unknown; updatedAt: number } | null>;
  putMissionWorkspaceSnapshot(wallet: string, missionId: string, payload: unknown): Promise<number>;
  deleteMissionWorkspaceSnapshotsForMission(missionId: string): Promise<void>;

  /** Mission artifacts (files, specs, generated code) persisted for agentic runs. */
  listMissionArtifacts(wallet: string, missionId: string): Promise<MissionArtifact[]>;
  createMissionArtifact(input: Omit<MissionArtifact, "id" | "createdAt">): Promise<MissionArtifact>;
}
