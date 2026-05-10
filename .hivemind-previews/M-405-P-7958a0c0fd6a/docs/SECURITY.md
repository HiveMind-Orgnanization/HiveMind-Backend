# Security Checklist — Snake Neo

Scope: This document covers the security posture of the shipped Snake Neo web application (React frontend + Node/Express + SQLite backend). The app is designed for casual gameplay and does not handle sensitive data.

## Data Classification

- **Leaderboard entries**: Public display data (name, score, difficulty, timestamp).
- **Preferences**: Stored in browser `localStorage` (difficulty, sound, theme, best local score). Non-sensitive.
- **No authentication**: There are no user accounts, passwords, or tokens.

## Frontend Security

- **XSS Mitigation**
  - React escapes content by default.
  - User-provided `name` is never rendered via `dangerouslySetInnerHTML`.
  - No HTML is accepted from users; only plain strings.

- **Local Storage**
  - Only non-sensitive data is stored (preferences, best score).
  - Keys are namespaced (e.g., `snake-neo:*`).

- **Dependencies**
  - Use recent versions of React, Vite, and Tailwind.
  - Run `npm audit` periodically and update dependencies.

## Backend Security

- **Input Validation**
  - `POST /api/leaderboard` validates:
    - `name`: string, trimmed, length-limited.
    - `score`: positive integer within reasonable bounds.
    - `difficulty`: one of `easy`, `normal`, `hard`.

- **SQL Injection**
  - All database operations use parameterized queries via `better-sqlite3`.

- **Error Handling**
  - API returns generic error messages; internal errors are logged to the console.

- **CORS**
  - CORS is enabled for development; for production, restrict `origin` to the deployed frontend domain.

- **Rate Limiting (Not Implemented)**
  - Currently, there is no rate limiting. For public internet deployment, consider:
    - IP-based rate limiting on `POST /api/leaderboard`.
    - Basic request throttling middleware.

## Transport Security

- **HTTPS**
  - Use HTTPS for both frontend and backend in production.
  - If deploying behind a reverse proxy (e.g., Nginx, Cloudflare), terminate TLS at the proxy.

## Logging & Monitoring

- Minimal logging is implemented (startup, DB init errors, API errors).
- For production, consider:
  - Structured logging (JSON) with request IDs.
  - Centralized log aggregation.

## Hardening Checklist

- [ ] Restrict CORS origin in production.
- [ ] Add basic rate limiting to leaderboard POST endpoint.
- [ ] Add request size limits to Express (`express.json({ limit: "10kb" })`).
- [ ] Regularly run `npm audit` and patch vulnerabilities.
- [ ] Ensure file permissions on `snake.db` are restricted to the app user.

## Threats Out of Scope

- Account takeover (no accounts exist).
- Payment fraud (no payments or on-chain interactions).
- Strong identity verification.

Given the casual nature of the app and absence of sensitive data, the current controls are appropriate for hobby and demo deployments. For large-scale or commercial deployments, implement the hardening steps above and consider adding authentication and stricter monitoring.