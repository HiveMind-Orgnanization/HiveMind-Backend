import { randomBytes } from "node:crypto";
import type { HiveMindStore } from "./hivemind-store.types";
import type {
  AgentProfile,
  AuthChallenge,
  MemoryChunk,
  MissionArtifact,
  Mission,
  PaymentIntent,
  Task,
} from "../types/domain";

function missionId(): string {
  return `M-${248 + Math.floor(Math.random() * 750)}`;
}

function seedMissions(): Mission[] {
  const now = Date.now();
  return [
    {
      id: "M-247",
      title: "Launch Solana AI Marketing Campaign",
      objective:
        "Autonomous workforce coordinating brand strategy, content production, and on-chain promotion across X, Farcaster, and Solana ecosystem partners.",
      priority: "high",
      status: "active",
      agents: ["Strategy", "Research", "Design", "Treasury", "Analytics", "Coordination"],
      budget: 48,
      cost: 29.76,
      progress: 68,
      createdAt: now - 1000 * 60 * 60 * 4,
      eta: "02h 14m",
      confidence: 92,
    },
  ];
}

function seedAgents(): AgentProfile[] {
  return [
    { id: "agent-atlas", name: "Atlas", specialization: "Strategy", model: "Claude 4.7", reputation: 4.97, missionsCompleted: 412, trustScore: 96 },
    { id: "agent-vega", name: "Vega", specialization: "Research", model: "GPT-5", reputation: 4.95, missionsCompleted: 388, trustScore: 94 },
    { id: "agent-lumen", name: "Lumen", specialization: "Design", model: "Llama 4", reputation: 4.92, missionsCompleted: 364, trustScore: 91 },
    { id: "agent-orion", name: "Orion", specialization: "Development", model: "DeepSeek", reputation: 4.74, missionsCompleted: 152, trustScore: 85 },
    { id: "agent-nyx", name: "Nyx", specialization: "Marketing", model: "GPT-5", reputation: 4.78, missionsCompleted: 268, trustScore: 86 },
    { id: "agent-halo", name: "Halo", specialization: "Coordination", model: "Claude 4.7", reputation: 4.89, missionsCompleted: 342, trustScore: 95 },
    { id: "agent-echo", name: "Echo", specialization: "Analytics", model: "Qwen 3", reputation: 4.84, missionsCompleted: 318, trustScore: 88 },
    { id: "agent-axiom", name: "Axiom", specialization: "Treasury", model: "DeepSeek", reputation: 4.81, missionsCompleted: 296, trustScore: 90 },
    { id: "agent-sage", name: "Sage", specialization: "Memory", model: "Qwen 3", reputation: 4.69, missionsCompleted: 124, trustScore: 83 },
  ];
}

function seedTasks(mid: string): Task[] {
  const t = Date.now();
  return [
    { id: "T-014", missionId: mid, title: "Define KPI tree", agent: "Strategy", status: "done", stage: "Planning", createdAt: t },
    { id: "T-021", missionId: mid, title: "Solana ecosystem trend report", agent: "Research", status: "done", stage: "Research", createdAt: t },
    { id: "T-031", missionId: mid, title: "Hero video storyboard", agent: "Design", status: "active", stage: "Generation", createdAt: t },
  ];
}

function seedMemory(): MemoryChunk[] {
  return [
    { id: "MEM-1842", missionId: "M-247", text: "Brand consistency rules · v3 · cyan/purple gradient set", embeddingDims: 384, score: 0.94 },
    { id: "MEM-1781", missionId: "M-247", text: "Solana ecosystem mid-cap reach matrix · April 2026", embeddingDims: 384, score: 0.91 },
    { id: "MEM-1704", text: "Press kit bundle template · 24MB · stock layouts", embeddingDims: 384, score: 0.88 },
  ];
}

function workspaceSnapKey(wallet: string, missionId: string): string {
  return `${wallet}\n${missionId}`;
}

/** In-process store (no DATABASE_URL). */
export class MemoryHiveMindStore implements HiveMindStore {
  private missions: Mission[];
  private agents: AgentProfile[];
  private tasks: Task[];
  private payments: PaymentIntent[];
  private memory: MemoryChunk[];
  private challenges = new Map<string, AuthChallenge>();
  private workspaceSnapshots = new Map<string, { payload: unknown; updatedAt: number }>();
  private artifacts: MissionArtifact[] = [];

  constructor() {
    this.missions = seedMissions();
    this.agents = seedAgents();
    const mid = this.missions[0]?.id ?? "M-247";
    this.tasks = seedTasks(mid);
    this.payments = [];
    this.memory = seedMemory();
  }

  async close(): Promise<void> {
    /* no-op */
  }

  async createChallenge(wallet: string): Promise<AuthChallenge> {
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = Date.now() + 1000 * 60 * 10;
    const message = `HiveMind Protocol login\nWallet: ${wallet}\nNonce: ${nonce}\nExpires: ${new Date(expiresAt).toISOString()}`;
    const ch: AuthChallenge = { wallet, nonce, message, expiresAt };
    this.challenges.set(wallet, ch);
    return ch;
  }

  async consumeChallenge(wallet: string): Promise<AuthChallenge | undefined> {
    const ch = this.challenges.get(wallet);
    this.challenges.delete(wallet);
    return ch;
  }

  async listMissions(wallet?: string): Promise<Mission[]> {
    const all = [...this.missions].sort((a, b) => b.createdAt - a.createdAt);
    if (!wallet) return all;
    return all.filter((m) => (m as Mission & { wallet?: string }).wallet === wallet);
  }

  async getMission(id: string): Promise<Mission | undefined> {
    return Promise.resolve(this.missions.find((m) => m.id === id));
  }

  async createMission(input: Omit<Mission, "id" | "createdAt"> & { wallet?: string }): Promise<Mission> {
    const m: Mission & { wallet?: string } = {
      ...input,
      id: missionId(),
      createdAt: Date.now(),
    };
    this.missions.unshift(m);
    return m;
  }

  async patchMission(id: string, patch: Partial<Mission>): Promise<Mission | undefined> {
    const idx = this.missions.findIndex((m) => m.id === id);
    if (idx < 0) return undefined;
    this.missions[idx] = { ...this.missions[idx], ...patch };
    return this.missions[idx];
  }

  async deleteMission(id: string): Promise<boolean> {
    await this.deleteMissionWorkspaceSnapshotsForMission(id);
    const before = this.missions.length;
    this.missions = this.missions.filter((m) => m.id !== id);
    this.tasks = this.tasks.filter((t) => t.missionId !== id);
    return this.missions.length < before;
  }

  async getMissionWorkspaceSnapshot(
    wallet: string,
    missionId: string,
  ): Promise<{ payload: unknown; updatedAt: number } | null> {
    return Promise.resolve(this.workspaceSnapshots.get(workspaceSnapKey(wallet, missionId)) ?? null);
  }

  async putMissionWorkspaceSnapshot(wallet: string, missionId: string, payload: unknown): Promise<number> {
    const updatedAt = Date.now();
    this.workspaceSnapshots.set(workspaceSnapKey(wallet, missionId), { payload, updatedAt });
    return updatedAt;
  }

  async deleteMissionWorkspaceSnapshotsForMission(missionId: string): Promise<void> {
    for (const key of [...this.workspaceSnapshots.keys()]) {
      if (key.endsWith(`\n${missionId}`)) this.workspaceSnapshots.delete(key);
    }
    return Promise.resolve();
  }

  async listMissionArtifacts(wallet: string, missionId: string): Promise<MissionArtifact[]> {
    return Promise.resolve(
      this.artifacts
        .filter((a) => a.missionId === missionId && a.wallet === wallet)
        .sort((a, b) => b.createdAt - a.createdAt),
    );
  }

  async createMissionArtifact(input: Omit<MissionArtifact, "id" | "createdAt">): Promise<MissionArtifact> {
    const a: MissionArtifact = {
      ...input,
      id: `A-${randomBytes(6).toString("hex")}`,
      createdAt: Date.now(),
    };
    this.artifacts.unshift(a);
    return a;
  }

  async listAgents(): Promise<AgentProfile[]> {
    return Promise.resolve([...this.agents]);
  }

  async getAgent(id: string): Promise<AgentProfile | undefined> {
    return Promise.resolve(this.agents.find((a) => a.id === id || a.name === id));
  }

  async listTasks(missionId?: string): Promise<Task[]> {
    return Promise.resolve(this.tasks.filter((t) => !missionId || t.missionId === missionId));
  }

  async createTask(input: Omit<Task, "id" | "createdAt">): Promise<Task> {
    const t: Task = {
      ...input,
      id: `T-${randomBytes(6).toString("hex")}`,
      createdAt: Date.now(),
    };
    this.tasks.unshift(t);
    return t;
  }

  async patchTask(id: string, patch: Partial<Task>): Promise<Task | undefined> {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx < 0) return undefined;
    this.tasks[idx] = { ...this.tasks[idx], ...patch };
    return this.tasks[idx];
  }

  async listPayments(missionId?: string): Promise<PaymentIntent[]> {
    return Promise.resolve(this.payments.filter((p) => !missionId || p.missionId === missionId));
  }

  async createPaymentIntent(input: Omit<PaymentIntent, "id" | "createdAt" | "status">): Promise<PaymentIntent> {
    const p: PaymentIntent = {
      ...input,
      id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "pending",
      createdAt: Date.now(),
    };
    this.payments.unshift(p);
    return p;
  }

  async searchMemory(query: string, topK: number): Promise<MemoryChunk[]> {
    const q = query.toLowerCase();
    const ranked = this.memory
      .map((m) => ({
        m,
        hits: m.text
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => q.includes(w) || m.text.toLowerCase().includes(w)).length,
      }))
      .sort((a, b) => (b.hits || 0) - (a.hits || 0) || (b.m.score ?? 0) - (a.m.score ?? 0))
      .slice(0, topK)
      .map((x) => x.m);
    return Promise.resolve(ranked.length ? ranked : this.memory.slice(0, topK));
  }

  async listMemoryChunks(): Promise<MemoryChunk[]> {
    return Promise.resolve([...this.memory]);
  }
}
