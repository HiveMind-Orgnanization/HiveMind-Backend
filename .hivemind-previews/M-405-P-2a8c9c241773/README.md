# Snake Neo — Modern Snake Game Web App

Snake Neo is a modern, responsive Snake game with smooth canvas gameplay, difficulty modes, sound effects, a persistent leaderboard, and customizable settings.

## Features

- 🎮 Smooth Snake gameplay using HTML5 Canvas
- 📱 Fully responsive layout with mobile touch controls
- 🧠 Difficulty modes: Easy, Normal, Hard
- 🔊 Sound effects for food, game over, and UI clicks
- 🏆 Leaderboard with persistent storage (SQLite via Node/Express API)
- ⚙️ Settings for difficulty, sound, and theme (light/dark)
- 💾 Local persistence for preferences and best score
- ✅ Error boundaries, loading states, and accessible UI

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router, Tailwind CSS
- **Backend**: Node.js, Express, SQLite (via `better-sqlite3`)

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### 1. Install dependencies

```bash
# From repo root
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure environment

Create `frontend/.env` with the backend API base URL. The value must already include `/api` at the end:

```bash
VITE_API_URL=http://localhost:4000/api
```

The frontend will call endpoints like `${import.meta.env.VITE_API_URL}/leaderboard`.

### 3. Run the backend

```bash
cd backend
npm start
```

This starts the API server on `http://localhost:4000` and initializes `snake.db` (SQLite) with a `scores` table.

### 4. Run the frontend

```bash
cd frontend
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`).

### 5. Build for production

```bash
cd frontend
npm run build
npm run preview
```

Backend is a simple API server; you can deploy it separately (e.g., Render, Railway, Fly.io) and point `VITE_API_URL` to the deployed API.

## Frontend Overview

- **Routing**
  - `/` — Home / Landing page
  - `/game` — Game canvas and controls
  - `/leaderboard` — Leaderboard view
  - `/settings` — Settings page
  - `*` — Not Found page

- **Key Components**
  - `AppShell` — Layout with header, nav, and footer
  - `GameCanvas` — Core Snake game loop and rendering
  - `ScoreBoard`, `PauseOverlay`, `MobileControls`, `GameOverModal`
  - `LeaderboardTable`, `FilterTabs`
  - `DifficultySelector`, `ToggleSwitch`, `ResetButton`
  - `ToastProvider`, `ErrorBoundary`, `LoadingSpinner`

- **State & Persistence**
  - Preferences (difficulty, sound, theme) stored in `localStorage`
  - Best local score stored in `localStorage`
  - Leaderboard stored in SQLite via backend API

## Backend Overview

- **Base URL**: `http://localhost:4000/api`
- **Endpoints**:
  - `GET /leaderboard?range=all|week` — Fetch scores
  - `POST /leaderboard` — Submit score `{ name, score, difficulty }`
  - `GET /health` — Health check

Scores are stored in `snake.db` (SQLite) with fields: `id`, `name`, `score`, `difficulty`, `created_at`.

## Running Tests

This starter does not include automated tests yet. Recommended next steps:

- Add unit tests for game logic (movement, collisions)
- Add API tests for leaderboard endpoints

## Security Notes

- No authentication is implemented; leaderboard names are public display names only.
- Do not store sensitive data in this system.
- See `docs/SECURITY.md` for a checklist of current controls and recommendations.

## Architecture

See `docs/ARCHITECTURE.md` for a detailed description of the frontend and backend structure, data flows, and deployment considerations.

## License

MIT — feel free to use and extend for your own projects.