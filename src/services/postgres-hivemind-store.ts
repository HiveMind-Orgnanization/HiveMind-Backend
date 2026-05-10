import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { Pool } from "pg";
import type { HiveMindStore } from "./hivemind-store.types";
import type {
  AgentProfile,
  AuthChallenge,
  MemoryChunk,
  MissionArtifact,
  Mission,
  MissionConfig,
  MissionStatus,
  PaymentIntent,
  Task,
} from "../types/domain";

function missionId(): string {
  return `M-${248 + Math.floor(Math.random() * 750)}`;
}

async function migrate(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialization TEXT NOT NULL,
      model TEXT NOT NULL,
      reputation DOUBLE PRECISION NOT NULL,
      missions_completed INT NOT NULL,
      trust_score INT NOT NULL,
      wallet_pubkey TEXT
    );

    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      objective TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      agents JSONB NOT NULL DEFAULT '[]',
      budget DOUBLE PRECISION NOT NULL,
      cost DOUBLE PRECISION NOT NULL,
      progress INT NOT NULL,
      created_at BIGINT NOT NULL,
      eta TEXT NOT NULL DEFAULT '—',
      confidence DOUBLE PRECISION NOT NULL DEFAULT 80
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      agent TEXT NOT NULL,
      status TEXT NOT NULL,
      stage TEXT,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      amount_sol DOUBLE PRECISION NOT NULL,
      recipient_pubkey TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_chunks (
      id TEXT PRIMARY KEY,
      mission_id TEXT,
      text TEXT NOT NULL,
      embedding_dims INT NOT NULL,
      score DOUBLE PRECISION
    );

    CREATE TABLE IF NOT EXISTS auth_challenges (
      wallet TEXT PRIMARY KEY,
      nonce TEXT NOT NULL,
      message TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_missions_created ON missions (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_mission ON tasks (mission_id);
  `);

  await client.query(`
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS mission_workspace_snapshots (
      wallet TEXT NOT NULL,
      mission_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (wallet, mission_id)
    );
    CREATE INDEX IF NOT EXISTS idx_mws_wallet ON mission_workspace_snapshots (wallet);
    CREATE INDEX IF NOT EXISTS idx_mws_mission ON mission_workspace_snapshots (mission_id);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS mission_artifacts (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      wallet TEXT NOT NULL,
      agent TEXT NOT NULL,
      role TEXT NOT NULL,
      kind TEXT NOT NULL,
      path TEXT NOT NULL,
      language TEXT,
      content TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ma_mission_wallet ON mission_artifacts (mission_id, wallet, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ma_mission_path ON mission_artifacts (mission_id, path);
  `);
}

function parseMissionConfig(raw: unknown): MissionConfig | undefined {
  if (raw == null) return undefined;
  try {
    const obj = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    if (!obj || typeof obj !== "object") return undefined;
    if (Object.keys(obj as object).length === 0) return undefined;
    return obj as MissionConfig;
  } catch {
    return undefined;
  }
}

function rowMission(r: Record<string, unknown>): Mission {
  const agents = r.agents;
  const agentList = Array.isArray(agents)
    ? (agents as string[])
    : typeof agents === "string"
      ? (JSON.parse(agents) as string[])
      : [];
  const base: Mission = {
    id: String(r.id),
    title: String(r.title),
    objective: String(r.objective),
    priority: String(r.priority),
    status: String(r.status) as MissionStatus,
    agents: agentList,
    budget: Number(r.budget),
    cost: Number(r.cost),
    progress: Number(r.progress),
    createdAt: Number(r.created_at),
    eta: String(r.eta ?? "—"),
    confidence: Number(r.confidence ?? 80),
  };
  const cfg = parseMissionConfig(r.config);
  return cfg ? { ...base, config: cfg } : base;
}

function rowAgent(r: Record<string, unknown>): AgentProfile {
  return {
    id: String(r.id),
    name: String(r.name),
    specialization: String(r.specialization),
    model: String(r.model),
    reputation: Number(r.reputation),
    missionsCompleted: Number(r.missions_completed),
    trustScore: Number(r.trust_score),
    walletPubkey: r.wallet_pubkey ? String(r.wallet_pubkey) : undefined,
  };
}

function rowTask(r: Record<string, unknown>): Task {
  return {
    id: String(r.id),
    missionId: String(r.mission_id),
    title: String(r.title),
    agent: String(r.agent),
    status: String(r.status) as Task["status"],
    stage: r.stage ? String(r.stage) : undefined,
    createdAt: Number(r.created_at),
  };
}

function rowPayment(r: Record<string, unknown>): PaymentIntent {
  return {
    id: String(r.id),
    missionId: String(r.mission_id),
    amountSol: Number(r.amount_sol),
    recipientPubkey: String(r.recipient_pubkey),
    status: String(r.status) as PaymentIntent["status"],
    createdAt: Number(r.created_at),
  };
}

function rowMemory(r: Record<string, unknown>): MemoryChunk {
  return {
    id: String(r.id),
    missionId: r.mission_id ? String(r.mission_id) : undefined,
    text: String(r.text),
    embeddingDims: Number(r.embedding_dims),
    score: r.score != null ? Number(r.score) : undefined,
  };
}

function rowArtifact(r: Record<string, unknown>): MissionArtifact {
  return {
    id: String(r.id),
    missionId: String(r.mission_id),
    wallet: String(r.wallet),
    agent: String(r.agent),
    role: String(r.role),
    kind: String(r.kind) as MissionArtifact["kind"],
    path: String(r.path),
    language: r.language ? String(r.language) : undefined,
    content: String(r.content),
    createdAt: Number(r.created_at),
  };
}

/** Upsert Development / Marketing / Memory agents for DBs seeded before those roles existed. */
async function ensureExtendedAgentRoster(pool: Pool): Promise<void> {
  const extra: AgentProfile[] = [
    { id: "agent-orion", name: "Orion", specialization: "Development", model: "DeepSeek", reputation: 4.74, missionsCompleted: 152, trustScore: 85 },
    { id: "agent-nyx", name: "Nyx", specialization: "Marketing", model: "GPT-5", reputation: 4.78, missionsCompleted: 268, trustScore: 86 },
    { id: "agent-sage", name: "Sage", specialization: "Memory", model: "Qwen 3", reputation: 4.69, missionsCompleted: 124, trustScore: 83 },
  ];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const a of extra) {
      await client.query(
        `INSERT INTO agents (id, name, specialization, model, reputation, missions_completed, trust_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.name, a.specialization, a.model, a.reputation, a.missionsCompleted, a.trustScore],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function seedIfEmpty(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ c: string }>("SELECT COUNT(*)::text AS c FROM agents");
  if (Number(rows[0]?.c ?? 0) > 0) return;

  const now = Date.now();
  const agents: AgentProfile[] = [
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const a of agents) {
      await client.query(
        `INSERT INTO agents (id, name, specialization, model, reputation, missions_completed, trust_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.name, a.specialization, a.model, a.reputation, a.missionsCompleted, a.trustScore],
      );
    }

    const mission: Mission = {
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
    };

    await client.query(
      `INSERT INTO missions (id, title, objective, priority, status, agents, budget, cost, progress, created_at, eta, confidence, config)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        mission.id,
        mission.title,
        mission.objective,
        mission.priority,
        mission.status,
        JSON.stringify(mission.agents),
        mission.budget,
        mission.cost,
        mission.progress,
        mission.createdAt,
        mission.eta,
        mission.confidence,
        JSON.stringify({}),
      ],
    );

    const tasks: Task[] = [
      { id: "T-014", missionId: mission.id, title: "Define KPI tree", agent: "Strategy", status: "done", stage: "Planning", createdAt: now },
      { id: "T-021", missionId: mission.id, title: "Solana ecosystem trend report", agent: "Research", status: "done", stage: "Research", createdAt: now },
      { id: "T-031", missionId: mission.id, title: "Hero video storyboard", agent: "Design", status: "active", stage: "Generation", createdAt: now },
    ];
    for (const t of tasks) {
      await client.query(
        `INSERT INTO tasks (id, mission_id, title, agent, status, stage, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.missionId, t.title, t.agent, t.status, t.stage ?? null, t.createdAt],
      );
    }

    const mem: MemoryChunk[] = [
      { id: "MEM-1842", missionId: mission.id, text: "Brand consistency rules · v3 · cyan/purple gradient set", embeddingDims: 384, score: 0.94 },
      { id: "MEM-1781", missionId: mission.id, text: "Solana ecosystem mid-cap reach matrix · April 2026", embeddingDims: 384, score: 0.91 },
      { id: "MEM-1704", text: "Press kit bundle template · 24MB · stock layouts", embeddingDims: 384, score: 0.88 },
    ];
    for (const m of mem) {
      await client.query(
        `INSERT INTO memory_chunks (id, mission_id, text, embedding_dims, score)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [m.id, m.missionId ?? null, m.text, m.embeddingDims, m.score ?? null],
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

function poolOptions(databaseUrl: string) {
  let ssl: boolean | undefined;
  try {
    const normalized = databaseUrl.replace(/^postgresql:/i, "http:");
    const host = new URL(normalized).hostname;
    if (host === "localhost" || host === "127.0.0.1") ssl = false;
  } catch {
    ssl = undefined;
  }
  const base = {
    connectionString: databaseUrl,
    max: 12,
    idleTimeoutMillis: 30_000,
  };
  return ssl !== undefined ? { ...base, ssl } : base;
}

export class PostgresHiveMindStore implements HiveMindStore {
  private readonly pool: Pool;

  private constructor(pool: Pool) {
    this.pool = pool;
  }

  static async connect(databaseUrl: string): Promise<PostgresHiveMindStore> {
    const pool = new Pool(poolOptions(databaseUrl));
    // Prevent unhandled pool errors from crashing the server (e.g., ETIMEDOUT / network blips).
    // pg-pool emits 'error' on idle clients; if nobody listens, Node will throw.
    pool.on("error", (err) => {
      console.warn("[hivemind] postgres pool error:", err);
    });
    const client = await pool.connect();
    try {
      await migrate(client);
    } finally {
      client.release();
    }
    await seedIfEmpty(pool);
    await ensureExtendedAgentRoster(pool);
    return new PostgresHiveMindStore(pool);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async createChallenge(wallet: string): Promise<AuthChallenge> {
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = Date.now() + 1000 * 60 * 10;
    const message = `HiveMind Protocol login\nWallet: ${wallet}\nNonce: ${nonce}\nExpires: ${new Date(expiresAt).toISOString()}`;
    await this.pool.query(
      `INSERT INTO auth_challenges (wallet, nonce, message, expires_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (wallet) DO UPDATE SET
         nonce = EXCLUDED.nonce,
         message = EXCLUDED.message,
         expires_at = EXCLUDED.expires_at`,
      [wallet, nonce, message, expiresAt],
    );
    return { wallet, nonce, message, expiresAt };
  }

  async consumeChallenge(wallet: string): Promise<AuthChallenge | undefined> {
    const { rows } = await this.pool.query("DELETE FROM auth_challenges WHERE wallet = $1 RETURNING *", [wallet]);
    const r = rows[0] as Record<string, unknown> | undefined;
    if (!r) return undefined;
    return {
      wallet: String(r.wallet),
      nonce: String(r.nonce),
      message: String(r.message),
      expiresAt: Number(r.expires_at),
    };
  }

  async listMissions(): Promise<Mission[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM missions ORDER BY created_at DESC",
    );
    return rows.map((row) => rowMission(row as Record<string, unknown>));
  }

  async getMission(id: string): Promise<Mission | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM missions WHERE id = $1", [id]);
    const r = rows[0] as Record<string, unknown> | undefined;
    return r ? rowMission(r) : undefined;
  }

  async createMission(input: Omit<Mission, "id" | "createdAt">): Promise<Mission> {
    const id = missionId();
    const createdAt = Date.now();
    await this.pool.query(
      `INSERT INTO missions (id, title, objective, priority, status, agents, budget, cost, progress, created_at, eta, confidence, config)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
      [
        id,
        input.title,
        input.objective,
        input.priority,
        input.status,
        JSON.stringify(input.agents),
        input.budget,
        input.cost,
        input.progress,
        createdAt,
        input.eta,
        input.confidence,
        JSON.stringify(input.config ?? {}),
      ],
    );
    return {
      ...input,
      id,
      createdAt,
    };
  }

  async patchMission(id: string, patch: Partial<Mission>): Promise<Mission | undefined> {
    const cur = await this.getMission(id);
    if (!cur) return undefined;
    const next = { ...cur, ...patch };
    await this.pool.query(
      `UPDATE missions SET
        title = $2, objective = $3, priority = $4, status = $5, agents = $6::jsonb,
        budget = $7, cost = $8, progress = $9, eta = $10, confidence = $11,
        config = $12::jsonb
       WHERE id = $1`,
      [
        id,
        next.title,
        next.objective,
        next.priority,
        next.status,
        JSON.stringify(next.agents),
        next.budget,
        next.cost,
        next.progress,
        next.eta,
        next.confidence,
        JSON.stringify(next.config ?? {}),
      ],
    );
    return next;
  }

  async deleteMission(id: string): Promise<boolean> {
    await this.pool.query("DELETE FROM mission_workspace_snapshots WHERE mission_id = $1", [id]);
    await this.pool.query("DELETE FROM mission_artifacts WHERE mission_id = $1", [id]);
    const { rowCount } = await this.pool.query("DELETE FROM missions WHERE id = $1", [id]);
    return (rowCount ?? 0) > 0;
  }

  async getMissionWorkspaceSnapshot(
    wallet: string,
    missionId: string,
  ): Promise<{ payload: unknown; updatedAt: number } | null> {
    const { rows } = await this.pool.query(
      "SELECT payload, updated_at FROM mission_workspace_snapshots WHERE wallet = $1 AND mission_id = $2",
      [wallet, missionId],
    );
    const r = rows[0] as Record<string, unknown> | undefined;
    if (!r) return null;
    return { payload: r.payload, updatedAt: Number(r.updated_at) };
  }

  async putMissionWorkspaceSnapshot(wallet: string, missionId: string, payload: unknown): Promise<number> {
    const updatedAt = Date.now();
    await this.pool.query(
      `INSERT INTO mission_workspace_snapshots (wallet, mission_id, payload, updated_at)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (wallet, mission_id) DO UPDATE SET
         payload = EXCLUDED.payload,
         updated_at = EXCLUDED.updated_at`,
      [wallet, missionId, JSON.stringify(payload), updatedAt],
    );
    return updatedAt;
  }

  async deleteMissionWorkspaceSnapshotsForMission(missionId: string): Promise<void> {
    await this.pool.query("DELETE FROM mission_workspace_snapshots WHERE mission_id = $1", [missionId]);
  }

  async listMissionArtifacts(wallet: string, missionId: string): Promise<MissionArtifact[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM mission_artifacts WHERE mission_id = $1 AND wallet = $2 ORDER BY created_at DESC",
      [missionId, wallet],
    );
    return rows.map((r) => rowArtifact(r as Record<string, unknown>));
  }

  async createMissionArtifact(input: Omit<MissionArtifact, "id" | "createdAt">): Promise<MissionArtifact> {
    const id = `A-${randomBytes(6).toString("hex")}`;
    const createdAt = Date.now();
    await this.pool.query(
      `INSERT INTO mission_artifacts (id, mission_id, wallet, agent, role, kind, path, language, content, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        input.missionId,
        input.wallet,
        input.agent,
        input.role,
        input.kind,
        input.path,
        input.language ?? null,
        input.content,
        createdAt,
      ],
    );
    return { ...input, id, createdAt };
  }

  async listAgents(): Promise<AgentProfile[]> {
    const { rows } = await this.pool.query("SELECT * FROM agents ORDER BY id");
    return rows.map((row) => rowAgent(row as Record<string, unknown>));
  }

  async getAgent(id: string): Promise<AgentProfile | undefined> {
    const { rows } = await this.pool.query(
      "SELECT * FROM agents WHERE id = $1 OR name = $1 LIMIT 1",
      [id],
    );
    const r = rows[0] as Record<string, unknown> | undefined;
    return r ? rowAgent(r) : undefined;
  }

  async listTasks(missionId?: string): Promise<Task[]> {
    const { rows } = missionId
      ? await this.pool.query("SELECT * FROM tasks WHERE mission_id = $1 ORDER BY created_at DESC", [missionId])
      : await this.pool.query("SELECT * FROM tasks ORDER BY created_at DESC");
    return rows.map((row) => rowTask(row as Record<string, unknown>));
  }

  async createTask(input: Omit<Task, "id" | "createdAt">): Promise<Task> {
    const createdAt = Date.now();
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = `T-${randomBytes(6).toString("hex")}`;
      try {
        await this.pool.query(
          `INSERT INTO tasks (id, mission_id, title, agent, status, stage, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, input.missionId, input.title, input.agent, input.status, input.stage ?? null, createdAt],
        );
        return { ...input, id, createdAt };
      } catch (e) {
        // Unique violation — retry with a new id.
        const err = e as { code?: string };
        if (err?.code === "23505" && attempt < 4) continue;
        throw e;
      }
    }
    throw new Error("Could not allocate unique task id");
  }

  async patchTask(id: string, patch: Partial<Task>): Promise<Task | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM tasks WHERE id = $1 LIMIT 1", [id]);
    const cur = rows[0] as Record<string, unknown> | undefined;
    if (!cur) return undefined;
    const current = rowTask(cur);
    const next = { ...current, ...patch, id: current.id };
    await this.pool.query(
      `UPDATE tasks SET
        mission_id = $2,
        title = $3,
        agent = $4,
        status = $5,
        stage = $6,
        created_at = $7
       WHERE id = $1`,
      [
        id,
        next.missionId,
        next.title,
        next.agent,
        next.status,
        next.stage ?? null,
        next.createdAt,
      ],
    );
    return next;
  }

  async listPayments(missionId?: string): Promise<PaymentIntent[]> {
    const { rows } = missionId
      ? await this.pool.query(
          "SELECT * FROM payments WHERE mission_id = $1 ORDER BY created_at DESC",
          [missionId],
        )
      : await this.pool.query("SELECT * FROM payments ORDER BY created_at DESC");
    return rows.map((row) => rowPayment(row as Record<string, unknown>));
  }

  async createPaymentIntent(input: Omit<PaymentIntent, "id" | "createdAt" | "status">): Promise<PaymentIntent> {
    const id = `PAY-${Math.floor(1000 + Math.random() * 9000)}`;
    const createdAt = Date.now();
    const status: PaymentIntent["status"] = "pending";
    await this.pool.query(
      `INSERT INTO payments (id, mission_id, amount_sol, recipient_pubkey, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, input.missionId, input.amountSol, input.recipientPubkey, status, createdAt],
    );
    return { ...input, id, status, createdAt };
  }

  async searchMemory(query: string, topK: number): Promise<MemoryChunk[]> {
    const { rows } = await this.pool.query("SELECT * FROM memory_chunks");
    const memory = rows.map((row) => rowMemory(row as Record<string, unknown>));
    const q = query.toLowerCase();
    const ranked = memory
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
    return ranked.length ? ranked : memory.slice(0, topK);
  }

  async listMemoryChunks(): Promise<MemoryChunk[]> {
    const { rows } = await this.pool.query("SELECT * FROM memory_chunks ORDER BY id");
    return rows.map((row) => rowMemory(row as Record<string, unknown>));
  }
}
