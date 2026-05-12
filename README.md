# HiveMind — Backend

> The Fastify + TypeScript backend for HiveMind, an autonomous AI workforce on Solana.

This service is the orchestration spine. It runs the multi-agent swarm, manages per-mission preview builds, persists missions / payments / memory chunks to Postgres, broadcasts realtime events over WebSocket, and exposes a wallet-authenticated REST API to the frontend.

**Frontend repo:** [HiveMind-Frontend](https://github.com/HiveMind-Orgnanization/HiveMind-Frontend) · **Demo:** [YouTube](https://www.youtube.com/watch?v=5d9067mHfPE&t=1s)

---

## What's in this repo

| Path | Purpose |
|---|---|
| `src/server.ts` | Fastify entry point — registers routes, plugins, error handlers |
| `src/routes/missions.ts` | Mission CRUD + async swarm-run + preview start/status |
| `src/routes/agents.ts` | Agent profile catalog |
| `src/routes/payments.ts` | Payment intent recording (wallet does the actual on-chain transfer) |
| `src/routes/trial.ts` | Free-trial register / claim / fund-wallet |
| `src/routes/memory.ts` | Shared memory chunks |
| `src/services/agent-runtime.ts` | Per-role system prompts, model routing, OpenAI calls |
| `src/services/preview-manager.ts` | Ephemeral Vite dev servers + artifact normalization |
| `src/services/realtime.ts` | WebSocket fan-out hub |
| `src/services/postgres-hivemind-store.ts` | Postgres adapter |
| `src/hooks/auth.ts` | `requireWallet()` JWT verification |

---

## Tech stack

- **Fastify 5** + **TypeScript** — HTTP + WebSocket server
- **OpenAI SDK** — all LLM calls route through this (multi-vendor routing is on the roadmap)
- **`@solana/web3.js` + `@coral-xyz/anchor`** — on-chain interactions (mainly for the funder wallet)
- **`pg`** — PostgreSQL client (Neon is the default host)
- **`ws`** — WebSocket realtime hub
- **`jsonwebtoken`** + **`tweetnacl`** — wallet-signature JWT auth
- **`zod`** — request validation

---

## Local setup

### Prerequisites

- **Node.js 20+**
- A **PostgreSQL** database (Neon, Supabase, or local Docker)
- An **OpenAI API key** with credits

### Install and run

```bash
git clone https://github.com/HiveMind-Orgnanization/HiveMind-Backend.git
cd HiveMind-Backend
npm install
cp .env.example .env   # then edit with your values
npm run dev
```

Server listens on `http://localhost:8787`.

### Environment variables

```bash
# Database (Neon URL or any Postgres connection string)
DATABASE_URL=postgres://user:password@host:5432/hivemind

# OpenAI — required. Every agent call routes through OPENAI_MODEL_ALL.
OPENAI_API_KEY=sk-...
OPENAI_MODEL_ALL=gpt-5.5
OPENAI_MODEL=gpt-5.5
OPENAI_MODEL_HEAVY=gpt-5.5
OPENAI_MODEL_CRIT=gpt-5.5

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=EV447FY9Q7Ty7pFo8wDPFRhkqASmj87GZjFr8CPjQ5om

# Funder keypair — sponsors free-trial registration for new wallets.
# Optional locally; without it, only the free-trial flow breaks.
FUNDER_SECRET_KEY=<base58-secret-or-JSON-byte-array>

# JWT secret for wallet-signature auth — generate any random 64+ char string
JWT_SECRET=<random-secret>

# Swarm tuning
SWARM_BUILD_REPAIR_MAX_ROUNDS=6

# Port
PORT=8787
```

### Database migrations

The `postgres-hivemind-store.ts` adapter runs `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS` on startup. No separate migration step needed for now — schema is small and additive.

### Local Postgres via Docker

```bash
docker compose up -d   # uses the included docker-compose.yml
```

Then set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres` in `.env`.

---

## Deployment

The production deployment runs on **AWS Elastic Beanstalk** in `ap-south-1` at `hivemind-backend-prod.eba-2pwjk2c2.ap-south-1.elasticbeanstalk.com`.

To deploy your own copy:

```bash
npm run build                 # → dist/
eb init hivemind-backend
eb create hivemind-backend-prod --platform "Node.js 20"
eb deploy
```

Environment variables are set via the EB console or `.ebextensions/`.

---

## API reference

The full REST + WebSocket API is documented in [hivemind-docs/api-reference](https://github.com/HiveMind-Orgnanization/HiveMind-Docs/blob/master/docs/api-reference.md).

Quick highlights:

| Endpoint | Purpose |
|---|---|
| `POST /api/missions` | Create a mission |
| `GET /api/missions` | List wallet's missions |
| `POST /api/missions/:id/swarm-run` | Start the swarm (returns 202 + jobId) |
| `POST /api/missions/:id/preview/start` | Build the preview (async) |
| `POST /api/invoke-async` | Single-agent invoke (follow-up chats) |
| `POST /api/payments/intent` | Record an on-chain payment intent |
| `WS /ws` | Realtime channel — subscribe to `global` or `mission:<id>` |

---

## Project conventions

- **Per-wallet scoping enforced server-side.** Every authed route runs through `requireWallet(req)` and filters by the wallet column.
- **Async by default.** Long-running endpoints return `202 { jobId }` and clients poll `/api/.../status/:jobId`. This keeps every endpoint inside Vercel's 30s rewrite ceiling.
- **No mock data.** If you're tempted to return fake numbers, return `null` or an empty array instead.
- **Errors are surfaced as JSON.** No HTML error pages, no stack traces in production responses.
- **WebSocket-first realtime.** No long-polling fallbacks. If the client can't open a WS, the UI degrades but doesn't fake updates.

---

## Contributing

PRs welcome. Three things to know before opening one:

1. **Open an issue first** for any non-trivial change. Especially anything that touches the agent runtime, schema, or auth.
2. **Match the existing style.** Fastify route handlers stay thin; logic moves into `src/services/*`.
3. **No new dependencies** that overlap with existing ones (e.g. don't add Express, don't add Prisma).

### Good first issues

- Add a `GET /api/health` route (currently missing some checks)
- Replace the hardcoded `OPENAI_MODEL_ALL` routing with provider-aware routing (Claude, Groq, Anthropic, etc.) — the UI already advertises this
- Add tests for `src/services/agent-runtime.ts` model fallback logic
- Improve preview-manager normalizations — the rolldown / postcss / tailwind heal loop is hard-coded; make it config-driven

### What we won't merge

- Anything that disables `requireWallet` on a previously-authed route
- Mock data that pretends to be live
- Comments that explain *what* code does (only *why*)
- Refactors of one subsystem that touch unrelated files

---

## Related repos

- **[HiveMind-Frontend](https://github.com/HiveMind-Orgnanization/HiveMind-Frontend)** — the Vite + React app
- **[hivemind-contracts](https://github.com/HiveMind-Orgnanization/hivemind-contracts)** — Anchor Solana program
- **[HiveMind-Docs](https://github.com/HiveMind-Orgnanization/HiveMind-Docs)** — Docusaurus docs site

---

## License

MIT — see `LICENSE`.

Built for the [Colosseum Hackathon](https://www.colosseum.org/), May 2026.
