# Support Desk

A full-stack customer support ticketing platform inspired by Zendesk/Freshdesk. Teams create, triage, and resolve support tickets with role-based access control, SLA tracking and breach alerts, canned responses, an inbound email webhook, full audit logging, and an analytics dashboard.

## Built With

- [React 19](https://react.dev/) + [Vite](https://vite.dev/) — frontend UI, built with plain CSS (no component library)
- [Express 5](https://expressjs.com/) — REST API (`/api/v1`)
- [MongoDB](https://www.mongodb.com/) + [Mongoose](https://mongoosejs.com/) — persistence
- [JWT](https://github.com/auth0/node-jsonwebtoken) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — authentication
- [Zod](https://zod.dev/) — request validation
- [Bun](https://bun.sh/) — package manager and workspace runner

Real-time UI updates (notifications) are delivered via short-interval polling rather than WebSockets, and the "email confirmation" on the inbound webhook is delivered as an in-app notification rather than an outbound email, in both cases to stay within the platform's dependency constraints.

The inbound email webhook (`POST /api/v1/webhooks/email`, JSON `{ from, senderName?, subject, body }`) only accepts requests that send the shared secret from `WEBHOOK_SECRET` in the `X-Webhook-Secret` header; without a configured secret it refuses every request.

### Dependencies

The dependencies are exactly the reference calendar app's, at the same pinned versions; nothing was added, removed, or replaced. Everything else uses the platform:

- The SLA breach/warning sweep runs every minute on a `setInterval` timer started with the API (`shared/jobs/sla-checker.js`); a sweep still running when the next one is due is skipped, not doubled.
- Sign-in, registration and webhook rate limits, and signed-out tokens, are kept in the API process's memory.
- Tests use Bun's built-in `bun test`.

## Project Structure

```text
coderepo-react-node-support-desk/
├── backend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/                # register/login/logout, User model
│   │   │   ├── tickets/              # CRUD, status transitions, SLA, auto-assign
│   │   │   ├── agents/                # agent roster + workload
│   │   │   ├── canned-responses/     # reusable reply templates
│   │   │   ├── audit-logs/           # immutable action trail
│   │   │   ├── notifications/        # in-app notifications (polled)
│   │   │   ├── analytics/            # aggregated dashboard
│   │   │   ├── webhooks/             # inbound email -> ticket
│   │   │   └── settings/             # SLA hours + categories
│   │   ├── shared/
│   │   │   ├── config/               # env, Mongo
│   │   │   ├── middleware/           # auth, RBAC, rate limit, error handler
│   │   │   └── jobs/                 # SLA sweep, every minute
│   │   ├── scripts/seed.js
│   │   ├── app.js
│   │   └── index.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── features/                 # one folder per product feature (api client + pages)
│   │   ├── shared/                   # api client, reusable components, utils
│   │   ├── App.jsx
│   │   └── styles.css
│   └── package.json
├── skills/validate/                  # HackerRank submission validator (copied, reference only)
├── transcripts/                      # exported AI build session log
├── AGENTS.md / GUIDELINES.md         # HackerRank submission contract (copied, reference only)
├── hackerrank.yml
└── setup.sh
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.4
- [MongoDB](https://www.mongodb.com/try/download/community) reachable at `127.0.0.1:27017` (or set `MONGODB_URI`)

### Development setup

```bash
bun install
bash setup.sh --seed   # copies .env files, verifies Mongo is reachable, seeds the database
bun start              # runs backend (:8000) and frontend (:3000) together
```

Visit `http://localhost:3000`. The frontend proxies `/api/*` to the backend automatically in development.

MongoDB behavior: `setup.sh` checks `127.0.0.1:27017` and starts a local `mongod` (via `.mongodb/`) if nothing is listening. The seed script always clears every collection and re-inserts a deterministic baseline, so re-running `bun run seed` (or restarting via `bun start`, which reseeds on every `prestart`) restores a known-good state.

### Seeded login credentials

All seeded accounts share one password: **`SupportDesk@2026`**

| Role | Email |
|---|---|
| Admin | `admin1@supportdesk.io`, `admin2@supportdesk.io` |
| Agent | `agent1@supportdesk.io` ... `agent5@supportdesk.io` (`agent5` is seeded inactive) |
| Customer | `customer1@supportdesk.io` ... `customer3@supportdesk.io` |

New accounts created through the "Create account" tab on the sign-in screen are always customers; agent and admin access is provisioned by an admin from the **Agents** page.

## Commands

| Command | Description |
|---|---|
| `bun install` | Install all workspace dependencies |
| `bash setup.sh --seed` | Bootstrap env files, verify Mongo, seed the database |
| `bun start` | Reseed, then run backend + frontend together |
| `bun run dev:backend` | Run only the backend, with file watching |
| `bun run dev:frontend` | Run only the frontend dev server |
| `bun run seed` | Re-seed the database (clears and re-inserts the baseline) |
| `cd frontend && bun run build` | Production frontend build |
| `bun run test` | API tests (`bun test`) against an isolated `support_desk_test` database; requires MongoDB to be running |

`hackerrank.yml` install/run commands: `bun install && bash setup.sh --seed` / `bun start`.
