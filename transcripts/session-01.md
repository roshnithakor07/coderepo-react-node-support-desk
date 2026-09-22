# Session 01 — Build Log

## [2026-09-22T05:34:00+00:00] Project scaffold

**Built:** Root workspace scaffold — Bun workspace `package.json`, `hackerrank.yml`, `setup.sh` (Mongo + Redis readiness, env bootstrap, seed trigger), `.prettierrc`, `.editorconfig`, `.prettierignore`, `.gitignore`, `.gitattributes`, `.vscode/launch.json`. Copied `AGENTS.md`, `GUIDELINES.md`, `skills/validate/` from the guidelines repo into the repo root per the required layout.

**Files created:**
- `package.json`, `hackerrank.yml`, `setup.sh`
- `.prettierrc`, `.editorconfig`, `.prettierignore`, `.gitignore`, `.gitattributes`
- `.vscode/launch.json`
- `AGENTS.md`, `GUIDELINES.md`, `skills/validate/**`

**Decisions made:**
- Followed the reference `coderepo-react-node-calendar` app's actual conventions (plain JS, plain CSS, Bun workspace scripts) rather than the TypeScript/Tailwind/Zustand wishlist in the internal plan doc, since the HackerRank guidelines require preserving the reference stack exactly.
- Added a Redis readiness check to `setup.sh` (mirroring the Mongo pattern) since Redis is a new, justified dependency (SLA-alert caching + auth rate limiting).
- Dropped Socket.io (WebSockets are disallowed by the platform-compatibility guidelines) in favor of frontend polling for notifications.

**Commit:** `feat: add project scaffold and workspace config`

---

## [2026-09-22T05:37:00+00:00] Backend shared core

**Built:** Config loader (env validation), Mongo connection helper, Redis connection helper, centralized error handler (`AppError`, Zod validation mapping), JWT bearer auth middleware, RBAC role-guard middleware, Redis-backed fixed-window rate limiter.

**Files created:**
- `backend/package.json`, `backend/.env.example`
- `backend/src/shared/config/index.js`, `database.js`, `redis.js`
- `backend/src/shared/errors/app-error.js`
- `backend/src/shared/middleware/auth.js`, `error-handler.js`, `rbac.js`, `rate-limit.js`

**Decisions made:**
- Response envelope convention `{ data }` / `{ error: { code, message, details } }`, matching the reference repo's contract exactly.
- Redis is used for JWT logout blacklisting and login rate limiting, justifying the new dependency.

**Commit:** `feat: add backend shared config, database, redis, and middleware`

---

## [2026-09-22T05:38:00+00:00] Auth feature

**Built:** User model (name/email/password/role/avatar/isActive), auth repository, auth service (register/login/logout/authenticate with bcrypt hashing + JWT signing + Redis token blacklist on logout), Zod-validated controller, routes mounted at `/api/v1/auth`.

**Files created:**
- `backend/src/features/auth/user.model.js`, `auth.repository.js`, `auth.service.js`, `auth.controller.js`, `auth.routes.js`

**Decisions made:**
- Logout blacklists the JWT in Redis until its natural expiry (JWTs are otherwise stateless), so a logged-out token is rejected immediately rather than remaining valid until expiry.
- Login is rate-limited (10/min per IP) to mitigate brute-force credential guessing.

**Commit:** `feat: add auth feature (register, login, logout)`
