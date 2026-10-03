# Support Desk

A full-stack customer support ticketing platform. Teams create, triage, and resolve support tickets with role-based access control, SLA tracking and breach alerts, canned responses, a full activity log, and an analytics dashboard.

## Built With

- [React 19](https://react.dev/) + [Vite 8](https://vite.dev/) — frontend UI, built with plain CSS (no component library)
- [Express 5](https://expressjs.com/) — REST API (`/api/v1`)
- [MongoDB](https://www.mongodb.com/) + [Mongoose](https://mongoosejs.com/) — persistence
- [JWT](https://github.com/auth0/node-jsonwebtoken) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — authentication
- [Zod](https://zod.dev/) — request validation
- [Bun](https://bun.sh/) — package manager and workspace runner

Notifications reach the browser through short-interval polling rather than WebSockets, and stay in the app rather than going out by email, to work within the platform's constraints.

### Dependencies

The dependencies are exactly the reference calendar app's, at the same pinned versions; nothing was added, removed, or replaced. Everything else uses the platform:

- The SLA breach/warning sweep runs every minute on a `setInterval` timer started with the API (`shared/jobs/sla-checker.js`); a sweep still running when the next one is due is skipped, not doubled.
- Sign-in and registration rate limits are kept in the API process's memory; signed-out tokens are stored in MongoDB (as hashes, removed automatically when they would have expired), so a restart doesn't undo a sign-out.
- Tests use Bun's built-in `bun test`.

## Product rules

The rules below are enforced in the service layer, not in the request handlers. Each one returns the
status code in the table with a message written for the person who hit it, the UI hides or disables
the action and shows the reason, and each has a `bun test` that proves it. Endpoints are relative to
`/api/v1`.

### Ticket lifecycle

The only path through the board is one step at a time:

```text
open -> in_progress -> pending <-> in_progress -> resolved -> closed
                                                     |           |
                                                     +-> open <--+   (reopen, 14 days)
```

| Rule | Endpoint | Code | Test |
|---|---|---|---|
| Nothing skips a step: an open ticket cannot jump to closed | `PUT /tickets/:id` | 409 `INVALID_TRANSITION` | "an open ticket cannot jump to closed" |
| An open ticket cannot be resolved without passing through in progress | `PUT /tickets/:id` | 409 `INVALID_TRANSITION` | "an open ticket cannot be resolved without going through in progress" |
| A pending ticket goes back to in progress before it can be resolved | `PUT /tickets/:id` | 409 `INVALID_TRANSITION` | "a pending ticket cannot be resolved until it is back in progress" |
| Nothing runs backwards except the reopen | `PUT /tickets/:id` | 409 `INVALID_TRANSITION` | "nothing runs backwards except the reopen" |
| Only a resolved or closed ticket can be reopened, and only to open | `PUT /tickets/:id` | 409 `INVALID_TRANSITION` | "only a finished ticket can be reopened" |
| A ticket closed more than 14 days ago cannot be reopened; the message says to open a new one | `PUT /tickets/:id` | 422 `REOPEN_WINDOW_EXPIRED` | "a ticket closed over fourteen days ago cannot be reopened, and says to open a new one" |
| Records written before the close stamp existed measure the window from their resolve stamp | `PUT /tickets/:id` | 422 `REOPEN_WINDOW_EXPIRED` | "a ticket closed before the close stamp existed measures the window from its resolve stamp" |
| A reopen restarts the SLA from the reopen moment, clears the breach, warning and resolve stamp, and is logged as `reopened` | `PUT /tickets/:id` | 200 | "a ticket resolved 46 hours ago comes back with a fresh window and is not breached by the next sweep" |
| Resolving requires at least one public staff reply | `PUT /tickets/:id` | 422 `RESOLUTION_REQUIRES_REPLY` | "an in-progress ticket with nothing the customer can read cannot be resolved" |
| An internal note does not count as that reply | `PUT /tickets/:id` | 422 `RESOLUTION_REQUIRES_REPLY` | "an internal note does not count as an answer" |
| A closed ticket takes no replies | `POST /tickets/:id/replies` | 409 `TICKET_CLOSED` | "no reply can be added" |
| A closed ticket's fields and priority are read-only | `PUT /tickets/:id` | 409 `TICKET_CLOSED` | "no field can be edited", "the priority cannot be changed either" |
| A closed ticket cannot be reassigned | `POST /tickets/:id/assign` | 409 `TICKET_CLOSED` | "it cannot be reassigned" |
| A customer's reply on a pending ticket hands it back to the team; the SLA clock and any breach carry on unchanged, because only a reopen starts a fresh period | `POST /tickets/:id/replies` | 201 | "a reply on a pending ticket hands it back to the team and keeps the breach and the clock" |
| A customer's reply on a resolved ticket reopens it, with a fresh SLA period and a `reopened` entry | `POST /tickets/:id/replies` | 201 | "a reply on a resolved ticket reopens it" |
| Only a public staff reply moves an open ticket to in progress; an internal note never moves it | `POST /tickets/:id/replies` | 201 | "a staff reply on an open ticket starts work, and an internal note never moves it" |
| A staff reply leaves the SLA clock alone | `POST /tickets/:id/replies` | 201 | "the SLA clock is untouched by a staff reply" |
| Re-sending the status a ticket already has changes nothing | `PUT /tickets/:id` | 200 | "re-sending the status a ticket already has is accepted and changes nothing" |

### SLA integrity

| Rule | Endpoint | Code | Test |
|---|---|---|---|
| A breach is permanent: changing the priority never clears it | `PUT /tickets/:id` | 200 | "changing the priority never clears the breach, and the new window runs from the change" |
| A priority change on a live ticket recomputes the deadline from the change moment, not from creation | `PUT /tickets/:id` | 200 | "changing the priority never clears the breach, and the new window runs from the change" |
| The audit entry for a priority change records the old and the new deadline | `GET /tickets/:id/audit` | 200 | "the audit entry records the old and the new deadline" |
| A finished ticket's deadline is left where it was | `PUT /tickets/:id` | 200 | "a resolved ticket's deadline is left where it was when its priority changes" |
| A move between two live statuses leaves the clock alone | `PUT /tickets/:id` | 200 | "a move between two active statuses leaves the clock alone" |
| The sweep flags an overdue ticket as the system, never as a person | background sweep | - | "flags an overdue ticket and records the breach as the system, not the customer" |
| Admins are told about every breach, not only the assignee | background sweep | - | "an SLA breach reaches every admin, not only the assignee" |
| A ticket with no assignee is reported to the admins once, not every minute | background sweep | - | "the sweep reports a ticket with no assignee once, not every minute" |

### Access

| Rule | Endpoint | Code | Test |
|---|---|---|---|
| Only customers raise tickets | `POST /tickets` | 403 `FORBIDDEN` | "an agent may not", "an admin may not" |
| A customer sees and touches only their own tickets | `PUT /tickets/:id` | 403 `FORBIDDEN` | "a customer cannot touch someone else's ticket" |
| A customer may close or reopen their own ticket, and nothing else in the lifecycle | `PUT /tickets/:id` | 403 `FORBIDDEN` | "a customer cannot move a ticket anywhere else in the lifecycle" |
| A customer cannot edit a ticket's details or priority | `PUT /tickets/:id` | 403 `FORBIDDEN` | "a customer cannot edit a ticket's details or priority" |
| Internal notes never reach a customer, on any endpoint that returns a ticket | `GET /tickets`, `GET /tickets/:id` | 200 | "ticket detail omits internal note content but keeps public replies", "ticket list omits internal note content" |
| A customer cannot post an internal note | `POST /tickets/:id/replies` | 201 (forced public) | "a customer cannot post an internal note" |
| An agent may assign only a ticket they can see; an admin any ticket | `POST /tickets/:id/assign` | 403 `FORBIDDEN` | "an agent cannot reassign a ticket assigned to another agent" |
| Only an existing, active agent can be assigned | `POST /tickets/:id/assign` | 400 `INVALID_AGENT` | "an inactive agent cannot be assigned", "a non-agent account cannot be assigned" |
| Auto-assignment skips inactive agents | `POST /tickets` | 201 | "never assigns a new ticket to an inactive agent" |
| The status history is readable only by people who can see the ticket | `GET /tickets/:id/history` | 403 `FORBIDDEN` | "nobody can read the history of a ticket they cannot see" |
| The full audit trail is admin-only | `GET /tickets/:id/audit`, `GET /audit-logs` | 403 `FORBIDDEN` | "agents and customers cannot read it" |
| Sign-up always creates a customer; the role cannot be chosen | `POST /auth/register` | 201 | "a newly registered customer cannot reach admin-only routes" |
| One account per email address | `POST /auth/register`, `POST /agents` | 409 `EMAIL_TAKEN` | "signing up with an email already in use is refused", "adding an agent with an email already in use is refused" |
| An inactive agent cannot sign in | `POST /auth/login` | 403 `FORBIDDEN` | "an inactive agent cannot sign in" |
| Signing out revokes the token everywhere, across restarts | `POST /auth/logout` | 401 `AUTH_REQUIRED` | "a signed-out token is still refused by a freshly started process (nothing held in memory)" |
| Canned responses are unreachable for customers | `GET`/`POST /canned-responses` | 403 `FORBIDDEN` | "customers cannot reach them at all" |
| An agent's template is personal; only an admin can publish a global one | `POST /canned-responses` | 201 | "an agent's template is personal, whatever they ask for" |
| A template is deletable only by its author or an admin | `DELETE /canned-responses/:id` | 403 `FORBIDDEN` | "an agent cannot delete a template somebody else owns" |
| Only admins change settings | `PUT /settings` | 403 `FORBIDDEN` | "only admins can change settings" |

### Input and resilience

| Rule | Endpoint | Code | Test |
|---|---|---|---|
| A status outside the list is a validation error, not a conflict | `PUT /tickets/:id` | 400 `VALIDATION_ERROR` | "a value outside the status list is still a validation error" |
| A malformed id anywhere in a path or query is rejected, never a 500 | all `/tickets/:id` routes | 400 `VALIDATION_ERROR` | "a malformed agentId is rejected with 400, not 500", "filtering tickets by a malformed assignee id returns 400" |
| A well-formed id that matches nothing is a 404 | all `/tickets/:id` routes | 404 `TICKET_NOT_FOUND` | "a well-formed id that does not exist still returns 404" |
| Malformed JSON is a 400 | all `POST`/`PUT` routes | 400 `INVALID_JSON` | "malformed JSON returns 400 INVALID_JSON" |
| A body over 100 KB is refused | all `POST`/`PUT` routes | 413 `PAYLOAD_TOO_LARGE` | "a body over the 100 KB limit returns 413 PAYLOAD_TOO_LARGE" |
| An invalid or backwards analytics date range is refused | `GET /analytics` | 400 `VALIDATION_ERROR` | "a non-date start returns 400", "a start after the end returns 400" |
| A rejected settings update leaves the stored settings untouched | `PUT /settings` | 400 `VALIDATION_ERROR` | "a rejected update leaves the stored settings unchanged" |
| A partial SLA update keeps the other priorities | `PUT /settings` | 200 | "a partial SLA update keeps the other priorities" |
| Sign-in is rate limited per address | `POST /auth/login` | 429 `RATE_LIMITED` | "the 11th sign-in attempt within a minute is refused" |
| Sign-up is rate limited per address | `POST /auth/register` | 429 `RATE_LIMITED` | "the 11th registration attempt within 10 minutes is refused" |
| The API answers only the configured frontend origin | all routes | - | "does not allow other origins" |

## Changes from the approved proposal

The proposal was written before the submission guidelines were applied to it. Where the two
disagreed, the guidelines won. Each change below is a deliberate decision, with the line it follows.

| Proposal item | What we built | Why |
|---|---|---|
| TypeScript across frontend and backend | JavaScript with ES modules, as the reference calendar repo is written | The sample stack is kept as declared (`AGENTS.md:238`). A TypeScript toolchain also means new build dependencies, which `GUIDELINES.md:65` forbids: "Do not add or replace any external runtime or development dependency". |
| Redis caching for analytics and sessions | No caching layer at all: analytics is aggregated in MongoDB per request, rate limits live in the API process's memory, and revoked tokens live in MongoDB | `GUIDELINES.md:65`. `ioredis` is not in the reference repo, so adding it would be a new runtime dependency. The dashboard is fast enough without it, and dropping the cache removed a class of stale-data bugs. |
| WebSockets for live ticket and notification updates | Notifications and counts are polled every 15 seconds | `GUIDELINES.md:186`: "The core product must not depend on capabilities unavailable in the HackerRank environment, such as outbound email, WebSockets, server-side file uploads, external hosted services". |
| Inbound email webhook that turns mail into tickets | Removed, along with its route and secret | `GUIDELINES.md:186`, same line: it needs an external sender and outbound mail to be useful, and it left a route with no screen behind it. Tickets are raised in the app instead. |
| Cursor pagination on the ticket list | Page-number pagination (`page` and `pageSize`) with the sort applied in MongoDB, so the order holds across pages | The list is filtered, sorted and counted server-side and the UI shows "Page N of M", which needs a total. Cursor pagination cannot produce that count, and the volume here does not need it. |
| "Inspired by Zendesk/Freshdesk" in the README | Removed; the product is described in its own words, and the seeded data uses `@example.com` addresses | `GUIDELINES.md:146`: "Do not use copyrighted assets, external brands, logos, or trademarked product content". |

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
| Admin | `admin1@example.com`, `admin2@example.com` |
| Agent | `agent1@example.com` ... `agent5@example.com` (`agent5` is seeded inactive) |
| Customer | `customer1@example.com` ... `customer3@example.com` |

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
| `bun run test` | API tests (`bun test`) against an isolated `support_desk_test` database (requires MongoDB), then the routing unit tests (`bun test` in `frontend`) |

`hackerrank.yml` install/run commands: `bun install && bash setup.sh --seed` / `bun start`.
