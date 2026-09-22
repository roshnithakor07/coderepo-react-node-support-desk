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

---

## [2026-09-22T05:41:00+00:00] Audit logs feature

**Built:** Immutable `AuditLog` model (ticketId/action/performedBy/changes, no update path exposed), repository (create/findByTicket/findAll paginated), service, admin-only `GET /api/v1/audit-logs` route. This is the append-only backbone other features write into (tickets, later).

**Files created:** `backend/src/features/audit-logs/audit-log.model.js`, `audit-log.repository.js`, `audit-log.service.js`, `audit-log.controller.js`, `audit-log.routes.js`

**Verification:** Reviewed for RBAC (admin-only route) and confirmed no delete/update repository method exists, matching the "immutable" requirement.

**Commit:** `feat: add audit logs feature`

---

## [2026-09-22T05:42:00+00:00] Notifications feature

**Built:** `Notification` model (userId/type/message/ticketId/isRead), repository, service (notify/notifyMany/listForUser/markRead/clearAll), routes for list, mark-read (specific ids or all), and clear-all.

**Files created:** `backend/src/features/notifications/notification.model.js`, `notification.repository.js`, `notification.service.js`, `notification.controller.js`, `notification.routes.js`

**Decisions made:** Since Socket.io/WebSockets are disallowed by the platform guidelines, "real-time" notifications will be delivered via frontend polling against this REST API rather than a live push channel.

**Commit:** `feat: add notifications feature`

---

## [2026-09-22T05:44:00+00:00] Settings feature (SLA config, categories)

**Built:** Singleton `Settings` document (slaHours per priority, category list), repository (get-or-create, update), Redis-cached service (5 min TTL, invalidated on update), controller/routes (public read, admin-only write). Built before the tickets feature since ticket SLA-deadline computation depends on it.

**Files created:** `backend/src/features/settings/settings.model.js`, `settings.repository.js`, `settings.service.js`, `settings.controller.js`, `settings.routes.js`

**Commit:** `feat: add settings feature (SLA config, categories)`

---

## [2026-09-22T05:45:00+00:00] Agents feature

**Built:** Agent listing with live open-ticket workload (Mongo aggregation joining tickets by assignee), agent creation (admin-only, bcrypt-hashed password), active/inactive toggle. Reuses the `User` model from the auth feature (agents are users with role `agent`) rather than a separate collection.

**Files created:** `backend/src/features/agents/agent.repository.js`, `agent.service.js`, `agent.controller.js`, `agent.routes.js`

**Commit:** `feat: add agents feature`

---

## [2026-09-22T05:50:00+00:00] Tickets feature (CRUD, status transitions, auto-assign, SLA)

**Built:** Core `Ticket` model (embedded replies, tags, SLA fields), repository, and the main service layer: status-transition state machine (`STATUS_TRANSITIONS` map, rejects illegal jumps), SLA deadline computation from `settingsService`, auto-assign to the least-loaded active agent on creation, role-scoped visibility (customer sees own, agent sees assigned, admin sees all), reply handling (internal notes forced to non-internal for customers; agent/admin reply on an "open" ticket auto-transitions it to "in_progress"), manual assign/reassign, and `runSlaSweep()` (breach detection + 30-minute-warning detection) consumed by the cron job. Every mutating action writes an audit log entry and, where relevant, a notification.

**Files created:** `backend/src/features/tickets/ticket.model.js`, `ticket.repository.js`, `ticket.service.js`, `ticket.controller.js`, `ticket.routes.js`, `backend/src/shared/jobs/sla-checker.js` (node-cron, runs `runSlaSweep()` every minute)

**Decisions made:** Priority changes recompute the SLA deadline from the ticket's original `createdAt` (not the edit time) and un-breach the ticket if the new deadline is in the future, matching how a real support desk would treat a priority correction.

**Commit:** `feat: add tickets feature (CRUD, status transitions, auto-assign, SLA)`

---

## [2026-09-22T05:52:00+00:00] Canned responses feature

**Built:** `CannedResponse` model (title/body/category/isGlobal), repository, service (admin templates default to global, agent templates are always personal; delete restricted to owner or admin), controller/routes scoped to admin/agent.

**Files created:** `backend/src/features/canned-responses/canned-response.model.js`, `canned-response.repository.js`, `canned-response.service.js`, `canned-response.controller.js`, `canned-response.routes.js`

**Commit:** `feat: add canned responses feature`

---

## [2026-09-22T05:56:00+00:00] Analytics feature with Redis cache

**Built:** Aggregation-pipeline repository (ticket volume by day, avg resolution time by priority, per-agent performance, SLA compliance rate, status breakdown), service that assembles the dashboard payload and caches it in Redis for 60s, admin-only route.

**Files created:** `backend/src/features/analytics/analytics.repository.js`, `analytics.service.js`, `analytics.controller.js`, `analytics.routes.js`

**Commit:** `feat: add analytics feature with Redis cache`

---

## [2026-09-22T05:59:00+00:00] Email webhook feature

**Built:** Public `POST /api/v1/webhooks/email` endpoint (rate-limited): finds or auto-provisions a customer account by sender email, creates a ticket via the existing `ticketService.create` (so auto-assign/SLA/audit logging all apply identically to webhook-originated tickets), then records an in-app notification for the customer.

**Files created:** `backend/src/features/webhooks/webhook.repository.js`, `webhook.service.js`, `webhook.controller.js`, `webhook.routes.js`. Also extended `notification.model.js`'s `type` enum with `ticket_created` for this confirmation notification.

**Decisions made:** Replaced the spec's "send confirmation email to customer" with an in-app notification, since outbound email is disallowed by the platform guidelines; the inbound webhook itself is unaffected since it's not an outbound dependency.

**Commit:** `feat: add email webhook feature`

---

## [2026-09-22T06:05:00+00:00] Wire up Express app and server entrypoint

**Built:** `app.js` (CORS, JSON body limit, static public dir, `/api/v1/health` reporting live Mongo connection state, all 9 feature routers mounted under `/api/v1/*`, 404 + centralized error handler) and `index.js` (env load, Mongo + Redis connect, SLA cron start, HTTP listen on 0.0.0.0:8000, graceful SIGINT/SIGTERM shutdown).

**Files created:** `backend/src/app.js`, `backend/src/index.js`

**Commit:** `feat: wire up express app and server entrypoint`

---

## [2026-09-22T06:10:00+00:00] Seed data script

**Built:** `backend/src/scripts/seed.js` — clears and re-seeds all six collections deterministically: 2 admins, 5 agents (one inactive), 3 customers, 5 canned responses, 20 tickets with a realistic spread of statuses/priorities/SLA states (some breached, some due soon, some resolved/closed with `resolvedAt` set, embedded replies including internal notes), matching audit-log entries, and a batch of notifications. Prints seeded login credentials at the end.

**Files created:** `backend/src/scripts/seed.js`

**Decisions made:** All seeded accounts share one password (`SupportDesk@2026`) per role-differentiated emails, for a simple, copyable README credentials block.

**Commit:** `feat: add seed data script`

---

## [2026-09-22T06:20:00+00:00] Local Mongo/Redis test tooling (infra, not app code)

**Built:** No app changes. Downloaded portable `redis-server` (extracted from Ubuntu's `.deb` packages, no root required) and official MongoDB Community Server (`fastdl.mongodb.org` tarball) into the session scratchpad so the backend can be smoke-tested locally without system package installs. Not part of the repo.

**Verification:** Confirmed `redis-server --version` and `mongod --version` both run successfully from the extracted binaries.

---

## [2026-09-22T06:25:00+00:00] Frontend scaffold started

**Built:** `frontend/package.json` (plain React 19 + Vite, no TypeScript/Tailwind/Zustand, matching the reference app's actual conventions), `vite.config.js` (port 3000, `/api` proxy to :8000), `.env.example`, `index.html`, favicon (shared with backend's static public page), shared API client (`shared/api/client.js` - fetch wrapper with bearer token, `{data}`/`{error}` envelope handling, session-expired event), per-feature `*.api.js` files (auth, tickets, agents, canned-responses, notifications, analytics, settings), shared utils (`format.js`, `theme.js`), and shared components (`Modal`, `Badge`/`StatusBadge`/`PriorityBadge`, `Table`, hand-rolled SVG `Charts` - bar/line/donut, avoiding a new charting dependency).

**Files created:** see above; full list in the commit that follows this entry.

**In progress:** Feature page components (auth screen done; tickets list/detail, agents page done so far; agents/canned-responses/analytics/notifications/workspace shell/App.jsx still in progress).
