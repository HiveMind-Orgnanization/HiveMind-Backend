# Snake Neo Architecture

## Overview

Snake Neo is a full-stack web application providing a modern Snake game experience with smooth gameplay, a persistent leaderboard, and customizable settings.

- **Frontend**: React + TypeScript + Vite SPA styled with Tailwind CSS.
- **Backend**: Node.js + Express REST API with SQLite (via `better-sqlite3`) for persistent leaderboard storage.

The system is intentionally simple and self-contained for easy local development and deployment.

## Frontend Architecture

### Tech Stack

- React 18 with functional components and hooks
- React Router for client-side routing
- Tailwind CSS for utility-first styling
- TypeScript for type safety

### Structure

```text
frontend/
  src/
    main.tsx
    App.tsx
    routes/
      Home.tsx
      Game.tsx
      Leaderboard.tsx
      Settings.tsx
      NotFound.tsx
    components/
      layout/AppShell.tsx
      layout/ErrorBoundary.tsx
      ui/Button.tsx
      ui/Modal.tsx
      ui/Toast.tsx
      ui/ToggleSwitch.tsx
      ui/LoadingSpinner.tsx
      game/GameCanvas.tsx
      game/ScoreBoard.tsx
      game/PauseOverlay.tsx
      game/MobileControls.tsx
      game/GameOverModal.tsx
      leaderboard/LeaderboardTable.tsx
      leaderboard/FilterTabs.tsx
      settings/DifficultySelector.tsx
      settings/ResetButton.tsx
      ThemeToggle.tsx
    hooks/
      useLocalStorage.ts
      useSound.ts
    lib/
      api.ts
      gameLogic.ts
    styles/
      index.css
```

### Routing & Layout

- `main.tsx` bootstraps React, wraps the app in `BrowserRouter`, `ToastProvider`, and `ErrorBoundary`.
- `App.tsx` defines routes and wraps pages in `AppShell`.
- `AppShell` provides a sticky header with navigation (Home, Play, Leaderboard, Settings), theme toggle, and responsive hamburger menu.

### Game Loop & Rendering

- `GameCanvas` owns the core game state:
  - Snake segments (array of coordinates)
  - Direction and next direction
  - Food position
  - Score and speed (based on difficulty)
  - Game status: running, paused, game over
- Uses `requestAnimationFrame` combined with a time accumulator to achieve smooth, frame-independent movement at a configurable ticks-per-second.
- Renders via `<canvas>` using the 2D context:
  - Grid background
  - Snake body and head
  - Food item
- Handles keyboard input (arrow keys / WASD) and integrates with `MobileControls` for touch.

### Difficulty & Settings

- `Settings` route exposes:
  - Difficulty selector (Easy, Normal, Hard)
  - Sound on/off
  - Theme (light/dark) toggle
  - Reset data button (clears local storage and optionally prompts user)
- Preferences are stored in `localStorage` via `useLocalStorage` hook and read by `GameCanvas` to adjust speed and grid size.

### Leaderboard

- `Leaderboard` route fetches scores from backend via `lib/api.ts`.
- `LeaderboardTable` renders a responsive table with rank, name, score, difficulty, and date.
- `FilterTabs` allows switching between `All-time` and `This Week` (implemented via `range` query parameter).
- Loading and error states are handled with `LoadingSpinner` and inline error messages.

### Error Handling & Feedback

- `ErrorBoundary` catches render-time errors and shows a friendly fallback with a button to return Home.
- `ToastProvider` exposes a context for showing transient notifications (e.g., "Score saved", "Failed to load leaderboard").
- `Modal` component is used for Game Over, reset confirmation, and other dialogs.

### Theming & Accessibility

- Tailwind dark mode is class-based; `ThemeToggle` toggles `dark` class on `<html>` and persists preference in `localStorage`.
- All interactive elements have focus styles and ARIA labels where appropriate.
- Keyboard controls:
  - Game: arrow keys / WASD for movement, space/Enter to pause/resume.
  - Modals: Esc to close when applicable.

## Backend Architecture

### Tech Stack

- Node.js 18+
- Express 4
- better-sqlite3 for synchronous, file-based SQLite access
- CORS enabled for local development

### Structure

```text
backend/
  src/
    index.ts
    db.ts
    routes/
      leaderboard.ts
  package.json
  tsconfig.json
```

### Database

- SQLite database file: `snake.db` in backend root.
- Single table: `scores`

```sql
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

- Index on `created_at` and `score` for efficient leaderboard queries.

### API Endpoints

Base path: `/api`

- `GET /api/health`
  - Returns `{ status: "ok" }` for health checks.

- `GET /api/leaderboard?range=all|week`
  - `range=all` (default): top N scores ordered by `score DESC, created_at ASC`.
  - `range=week`: scores from the last 7 days.
  - Response: `{ scores: Array<{ id, name, score, difficulty, createdAt }> }`.

- `POST /api/leaderboard`
  - Body: `{ name: string, score: number, difficulty: "easy"|"normal"|"hard" }`.
  - Validates input, inserts into `scores`, and returns the created record.

### Data Flow

1. **Game Over → Leaderboard**
   - `GameCanvas` detects collision and sets `gameOver` state.
   - `GameOverModal` opens, showing score and asking for player name.
   - On submit, frontend calls `POST /api/leaderboard` via `lib/api.ts`.
   - Backend validates and stores the score; frontend shows a toast and may prompt user to view leaderboard.

2. **Leaderboard View**
   - `Leaderboard` route mounts and calls `GET /api/leaderboard?range=all`.
   - User can switch to `This Week`, which triggers a refetch with `range=week`.

3. **Settings & Preferences**
   - Settings are stored in `localStorage` only; no backend persistence.
   - Game reads difficulty and sound settings on mount.

## Deployment Considerations

- **Backend**
  - Deploy as a Node service (e.g., Render, Railway, Fly.io, Heroku-like platforms).
  - Ensure the process has write access to create and update `snake.db`.
  - Configure CORS to allow the frontend origin.

- **Frontend**
  - Build static assets with `npm run build` and serve via any static host (Netlify, Vercel, S3+CloudFront, etc.).
  - Set `VITE_API_URL` at build time to point to the deployed backend (must end with `/api`).

- **Security**
  - No authentication; treat all data as public and non-sensitive.
  - See `docs/SECURITY.md` for more details.

## Future Enhancements

- Add authentication to tie scores to user accounts.
- Add more game modes (e.g., timed, obstacles).
- Add analytics events for gameplay and settings usage.
- Implement server-side pagination for very large leaderboards.
- Add automated tests for game logic and API endpoints.