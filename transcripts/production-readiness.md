# Production Readiness: Task Log

Task entries and design decisions for making Support Desk reviewer-ready. Append-only; timestamps come from `date`.

---

## [2026-09-27T06:07:51+00:00] Task 1: Read-only project audit

**Task:** Understand the project without changing app code. Produce an audit (features, endpoints, stack, rules, run results, gap analysis, phased plan). Stop for approval.

**Output:** `docs/PROJECT_AUDIT.md` (uncommitted).

**Decisions:**
- **Logging target:** The AGENTS.md log (`$HOME/hackerrank_react_node_application/log.txt`) plus this transcripts file, per the updated brief. The earlier `docs/WORK_LOG.md` request was superseded.
- **Onboarding:** Already recorded 2026-09-22 after the user typed "I agree". Not re-run and not self-recorded.
- **Audit placement:** `docs/PROJECT_AUDIT.md`, left uncommitted. The guidelines don't cover audit docs, but `skills/validate/SKILL.md:18` keeps reports out of the repo, and this report lists live vulnerabilities in a candidate-facing archive. Awaiting the user's decision.
- **Running the app:** The postman project was stopped with user approval to free 3000/8000 (required by GUIDELINES.md:172 and a read-only `vite.config.js`). No Redis container was created (user said no); an existing Docker `redis` was already serving 6379.
- **Live probes:** Wrote to the dev DB; the documented reset `bun run seed` restored the baseline afterwards.
- **Test tooling recommendation:** `bun test` (built in, no dependency) for API coverage now. Playwright for browser e2e only after explicit approval, since GUIDELINES.md:65/78 count dev dependencies.

**Top verified defects:** register role escalation; internal notes visible to customers; agents can reassign any ticket; inactive agents hidden, so reactivation is impossible; analytics end date excluded; 500s on invalid ids and malformed JSON; `/audit-logs` and `/webhooks/email` have no UI consumer (GUIDELINES.md:36); setup hard-fails without Redis; non-deterministic seed; Prettier config contradicts `.editorconfig`.

**Status:** Waiting for approval. No app code changed.

## [2026-09-27T06:32:52+00:00] Task 1 addendum: Theme color inventory

**Task:** List all colors used in both themes.

**Output:** `docs/PROJECT_AUDIT.md` Appendix A.

**Findings to carry into the UI phase:**
- Light-theme badges fail WCAG AA (as low as 1.92:1). Plan: add per-theme `*-text` tokens and keep the solid colors for fills.
- Declare `color-scheme` per theme so native controls match.
- Align the favicon color with `--accent`.
- Tokenize the ~7 hard-coded colors.

## [2026-09-27T06:44:33+00:00] Decisions recorded: answers to audit questions

**Dependency approval (GUIDELINES.md:78):** The user wrote: "I explicitly APPROVE adding `@playwright/test` as a devDependency for browser e2e tests." API tests use `bun test` (built in, no dependency). No other dependency is approved.

**Other decisions (from the user, 2026-09-27):**
- Customers may close and reopen their own tickets, within the existing transition rules.
- Agents may assign only tickets they can view; admins may assign any ticket.
- Hash routing (`#/tickets/:id`, native `hashchange`) approved for Phase 2.
- Redis stays, but must degrade gracefully and be reported in the health check.
- `bun audit fix` (lockfile only, within ranges) approved for Phase 4.
- `.prettierrc` switches to spaces (`useTabs:false`) to match `.editorconfig`, as a formatting-only branch.
- The audit lives at `../PROJECT_AUDIT.md` and the standing rules at `../support-desk-rules.md`. Both are outside the repo and never committed.
- `docs/WORK_LOG.md` dropped; the AGENTS.md log is the single work log.
- Theme refresh (deep teal, warm neutrals, WCAG AA badges): the token table must be approved before it's applied.

## Task 2 (Phase 0a): Review uncommitted UI shell WIP

**Scope:** 8 frontend files left uncommitted from the previous UI session.

**Checks:**
- `bun run build` passes.
- Every class used in the changed JSX has a CSS rule, except `sla-timer-pill` / `sla-timer-pill-track` (unstyled wrapper) and `ticket-detail` (harmless hook).
- The CSS for `.ticket-controls`, `.ticket-thread-empty` and `.ticket-description` is now unused.

**Status:** Summary shown to the user; waiting for OK to commit on `chore/ui-shell-wip`.

## [2026-09-27T06:50:14+00:00] Task 3: Structure and dependency comparison with the reference

**Task:** Compare our tree and dependencies with `ProblemSetters/coderepo-react-node-calendar` before Phase 0a. Read the upstream `react-node-application-guidelines` (shared by the user).

**Result:** The structure follows the reference pattern, and all 12 shared dependencies are pinned to identical versions. Full table in `../PROJECT_AUDIT.md` Appendix B.

**Differences:**
- no `assets/` hero screenshot
- `.prettierrc` not byte-identical (same values)
- `@fontsource/roboto` 5.3.0 replaced by Inter / JetBrains Mono 5.2.8, with no written reason
- no `ConfirmationDialog` shared component (we use `window.confirm`)

**Guideline conflicts raised with the user (decisions pending; options recorded for human judgment):**

1. **Prettier.** INSTRUCTIONS.md:40 says "Preserve the reference Prettier configuration and editor configuration", which conflicts with the earlier decision to set `useTabs:false`. Evidence: the reference is not Prettier-clean itself (78 files fail its own config; 65 with spaces), and its code uses 4 spaces like `.editorconfig`.
   - A. Keep `.prettierrc` byte-identical to the reference; check and format touched files with `prettier --no-use-tabs` (CLI override, no config change). *(recommended)*
   - B. Keep the config and reformat everything to tabs. Matches the config, but diverges from the reference code and `.editorconfig`.
   - C. Change `.prettierrc` to spaces. Violates INSTRUCTIONS.md:40.
2. **Fonts.** GUIDELINES.md:65 ("Do not add or replace") and INSTRUCTIONS.md:41 ("Preserve the reference's design system").
   - A. Restore `@fontsource/roboto` 5.3.0 and remove Inter / JetBrains Mono. *(recommended)*
   - B. Keep Inter, add a written reason in the README, and accept the validator S06 risk.
3. **Theme refresh vs INSTRUCTIONS.md:41.**
   - A. Keep the reference token architecture (surface / ink / accent / container / `color-scheme`) with a teal accent and warm neutrals. *(recommended)*
   - B. Keep our own token set with new colors.

## Task 2 (Phase 0a), continued: Commit UI shell WIP

**Branch:** `chore/ui-shell-wip`, from `main` @ 272ca1b (equal to `origin/main`).

**Commits:** the WIP 8 files exactly as they were, and this transcript file.

**Held back until the user decides:**
- the SLA pill CSS fix and dead-CSS removal (question still open)
- any Prettier formatting (depends on decision 1)

**Not pushed yet:** the pre-push rule "Prettier passes on changed files" can't be met until the Prettier option is chosen.

## [2026-09-27T06:57:07+00:00] Decisions recorded (user choices on guideline conflicts)

| Decision | Options considered | User's choice | User's reason |
|---|---|---|---|
| Prettier | A) keep reference `.prettierrc` byte-identical; format and check touched files with `--no-use-tabs`. B) keep config, reformat everything to tabs. C) change config to spaces (earlier plan). | **A** | INSTRUCTIONS.md:40, "Preserve the reference Prettier configuration and editor configuration." |
| Fonts | A) restore `@fontsource/roboto` 5.3.0 and remove Inter / JetBrains Mono. B) keep Inter with a written reason. | **A**, on branch `fix/restore-roboto` right after `chore/ui-shell-wip`; also fix the README claim | GUIDELINES.md:65 (no dependency replacement) and the design-system rule (INSTRUCTIONS.md:41) |
| Theme approach | A) teal and warm neutrals within the reference token structure. B) keep our token set, new colors. | **A** | Preserve the design system and still look distinctive |
| SLA pill fix | Add to `chore/ui-shell-wip`, or defer to the theme refresh | **Add** (plus unused CSS removal) | (none given) |

**Plan additions (user):**
- Phase 2: a `ConfirmationDialog` component matching the reference, replacing `window.confirm`.
- Phase 4: a real product screenshot in `assets/`, shown at the top of the README like the reference.

**Superseded:** the earlier "switch `.prettierrc` to spaces" decision (Task 1), and branch `chore/prettier-spaces`, which becomes `chore/prettier-reference`.

## Task 2 (Phase 0a), completed: `chore/ui-shell-wip`

**Commits:**
1. `34bed58`: the WIP 8 files, as they were.
2. `a747daa`: this transcript.
3. `585bd76`: SLA pill styles; removed the unused `.ticket-controls`, `.ticket-thread-empty` and `.ticket-description` rules.
4. `0534728`: Prettier 3.9.9 `--no-use-tabs` on the touched code files only (formatting only).
5. `94fcf87`: **bug found by the browser check.** `.sla-progress-fill` is an inline `<span>`, so its width and height were ignored and every SLA progress bar (ticket list and the new header pill) rendered at 0×0. Fixed with `display: block`. Now 20/20 list bars and the pill bar render.

**Verification:**
- Frontend build passes.
- Prettier check passes on the touched files.
- Throwaway Playwright (session scratchpad, not in the repo) signed in as admin, agent and customer, visited every sidebar view, opened a ticket, opened the notifications panel and signed out. 0 console errors or warnings, 0 page errors, 0 HTTP 5xx.

**Design decision (mine, minor):** the SLA pill uses only existing tokens (`--bg-elevated`, `--border`, `--radius-button`) so the theme refresh can re-skin it with no extra work.

## [2026-09-27T07:03:47+00:00] Task 4: Font dependency check, then `fix/restore-roboto`

**Question (from the user):** Would keeping Inter + JetBrains Mono FAIL `skills/validate`, or break a line in GUIDELINES.md / INSTRUCTIONS.md? If it's a hard fail, restore Roboto now. If it's only a risk, show Roboto vs Inter screenshots and wait.

**Check (the baseline for dependency review is the reference `coderepo-react-node-calendar`, per SKILL.md:58 and static-checks.md:31):**

| Source | Exact line | Verdict |
|---|---|---|
| skills/validate/SKILL.md:89 | "Removed dependencies are allowed; an added or replaced dependency that expands the approved surface fails unless explicit approval is documented." | **HARD FAIL.** Roboto was replaced by two font packages, and no approval is documented. |
| static-checks.md:14 (S06) | Fail when "An unapproved dependency was added or replaced, or an unused dependency remains." | **HARD FAIL** (S06). |
| GUIDELINES.md:65/67 | "Do not add or replace any external runtime or development dependency, including a: … package or library;" | **HARD FAIL** (the rule that S06 enforces). |
| static-checks.md S03 + GUIDELINES.md:235 | README fails when "inconsistent with the repository" | **HARD FAIL.** README.md:25 said "No other dependency was added, removed, or replaced", which was false. |
| INSTRUCTIONS.md:37 | "Any new dependency needs a written reason." | Violation (no reason written). Not a validator check. |
| INSTRUCTIONS.md:41 / GUIDELINES.md:196 | "Preserve the reference's design system…" / "Use the repository's existing design system…" | Risk (subjective). |
| INSTRUCTIONS.md:37 / REQUIREMENTS.md:37 | "Versions must be at least as recent as the reference." | Risk. Inter 5.2.8 < Roboto 5.3.0, although they are different packages. |

**Result:** hard fail. Per the user's rule ("If it's a hard fail: create fix/restore-roboto … and go ahead"), no screenshot comparison was needed.

**User decision recorded:** restore `@fontsource/roboto` 5.3.0, remove Inter and JetBrains Mono, fix the README claim. Reason: GUIDELINES.md:65 and the design-system rule (INSTRUCTIONS.md:41).

**Implementation decisions:**
- **Weights:** import Roboto `latin-400/500/600/700`. The reference imports only 400/500 and sets `font-synthesis: none`, but our CSS uses weight 600 (20 rules) and 700 (15 rules). Loading only 400/500 would flatten or fake-bold them. These are extra files from the same approved package, not a new dependency.
- **Mono font:** `--font-mono` now uses the system stack (`ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace`). The reference ships no mono font, so a system stack adds no dependency.
- **Font stack:** `--font-ui` matches the reference: `Roboto, Arial, sans-serif`.

**Verification:**
- Frontend `dependencies` and `devDependencies` are **identical** to the reference manifest.
- `bun.lock` lists only `@fontsource/roboto@5.3.0`.
- The build bundles only Roboto files.
- In the browser, `document.fonts` has loaded only Roboto 400/500/600/700.
- The 3-role smoke check shows 0 console errors, 0 page errors, 0 HTTP 5xx.
- Prettier `--no-use-tabs` passes on touched files.

## [2026-09-27T07:27:55+00:00] Decision: font weights and monospace font (user)

| Decision | Options considered | User's choice | Reason |
|---|---|---|---|
| Roboto weights | A) 400/500 only, like the reference (weights 600/700 flatten or fake-bold). B) 400/500/600/700 from the same approved package. | **B: keep 400/500/600/700** | Our CSS uses weight 600 (20 rules) and 700 (15 rules); the extra files add no new dependency. |
| Monospace font | A) system monospace stack (no dependency; varies slightly by OS). B) a font package (would be a new dependency). | **A: keep the system stack** | The reference ships no mono font; the dependency freeze applies (GUIDELINES.md:65). |

Approved by the user; `fix/restore-roboto` merged next.

## [2026-09-27T07:29:04+00:00] Task 5 (Phase 0b): `chore/prettier-reference`

**Goal (decision 3A):** make `.prettierrc` byte-identical to the reference (`coderepo-react-node-calendar` @ a671eef), per INSTRUCTIONS.md:40 ("Preserve the reference Prettier configuration and editor configuration").

**Change:** copied the reference `.prettierrc` byte-for-byte. The only difference was layout: the `overrides` array was written on one line. `cmp` confirms byte-identical (sha256 prefix 771ebd9c3d3f).

**No behavior change, verified:**
- the parsed JSON options are equal before and after
- `prettier --check --no-use-tabs` flags the same 12 files before and after (down from 18 before Phase 0a formatted 6)
- no source files reformatted (no mass reformat, per decision 3)

**Other config files vs the reference:**
- `.editorconfig`: identical
- `.prettierignore`: ours has one extra line, `.redis`. It is inert: Prettier only picks up supported file types when it scans a folder, and `.redis/` holds only Redis data and log files. Left unchanged pending the user's decision:
  - A) remove it, so `.prettierignore` is also byte-identical to the reference *(recommended)*
  - B) keep it, alongside the `.redis/` line in `.gitignore`

## [2026-09-27T07:30:49+00:00] Decision: `.prettierignore` `.redis` line (user)

| Decision | Options considered | User's choice | Reason |
|---|---|---|---|
| `.redis` line in `.prettierignore` | A) remove it, so `.prettierignore` is byte-identical to the reference. B) keep it, alongside the `.gitignore` entry. | **A: remove** | INSTRUCTIONS.md:40 (preserve the reference Prettier configuration). The line had no effect, because Prettier ignores `.redis/` data and log files anyway. |

Result: `.prettierrc`, `.prettierignore` and `.editorconfig` are all byte-identical to the reference. `.gitignore` keeps `.redis/`.

## [2026-09-27T07:34:30+00:00] Task 6 (Phase 0c): `test/api-harness`

**Goal:**
- `bun test` harness with an isolated DB (`support_desk_test`), a `createApp()` boot helper, per-role login helpers, a root `test` script, and smoke tests
- deterministic seed
- American English

**Files:**
- `backend/tests/setup.js` (preload)
- `backend/tests/helpers/api.js`
- `backend/tests/smoke.test.js`
- `backend/tests/seed.test.js`
- `backend/package.json` gains `"test": "bun test --preload ./tests/setup.js"`
- root `package.json` gains `"test": "cd backend && bun run test"`
- README Commands table: new test row
- `backend/src/scripts/seed.js`:
  - `isRead: Math.random() > 0.5` becomes `index % 2 === 1`
  - "Acknowledgement" becomes "Acknowledgment"
  - `// prettier-ignore` added above the ticket blueprint table

**Design decisions (my proposals, open to the user's review):**

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Test location | A) `backend/tests/` next to `src/`. B) `*.test.js` beside each feature in `src/features/*`. | A | Keeps `src/` identical in shape to the reference; the harness and helpers are cross-cutting. |
| How the harness starts | A) `bun test --preload ./tests/setup.js` in the script. B) a `bunfig.toml` with `[test] preload`. | A | No new config file that the reference lacks. Verified that `--preload` and a global `afterAll` work on Bun 1.4.2. |
| Test DB isolation | Always override `MONGODB_URI` with `TEST_MONGODB_URI` or `mongodb://127.0.0.1:27017/support_desk_test`, and **refuse any DB name not ending in `_test`**. | as stated | Bun auto-loads `backend/.env` (the dev DB); the guard makes wiping dev data impossible. |
| Redis isolation | Use Redis DB index 1 (`TEST_REDIS_URL`), `FLUSHDB` at start | as stated | Login rate-limit keys (10/min/IP) and the token blacklist can't collide with the running dev app. |
| Seeding | Run the real `src/scripts/seed.js` as a subprocess against the test DB | as stated | Tests exercise the exact seed that `bun start` uses; no refactor of the read-only seed path. |
| Login helper | Cache one session per role per run | as stated | Stays under the 10/min login rate limit. |
| Seed formatting | A) `// prettier-ignore` on `TICKET_BLUEPRINTS` only. B) let Prettier explode the table (141-line diff, mixed one-line and multi-line objects). C) leave `seed.js` unformatted. | A | Keeps the one-row-per-ticket table readable and still passes the "Prettier passes on changed files" rule. **Flagged for the user to confirm.** |

**Verification:**
- `bun run test`: **10 pass, 0 fail** (28 expects, about 3-10s).
- **Dev DB untouched** (verified properly the second time; the first attempt ran from the repo root, where `mongoose` doesn't resolve, so both fingerprints were error output and proved nothing):
  - `support_desk_db` had the same user ids before and after (…834fb3, …834fb4)
  - `support_desk_test` was re-seeded with new ids
- **Guard:** `TEST_MONGODB_URI=…/support_desk_db` fails with "Refusing to run tests against "support_desk_db"".
- **Tests prove the fixes:** with the old `seed.js` stashed, exactly the 2 seed-fix tests fail (deterministic read state; American English), and 8 pass. With the fix restored, 10/10 pass.
- Prettier `--no-use-tabs` passes on all 5 touched JS files.

**Noted for later (not changed here):** `CATEGORIES` in `seed.js` is unused (dead code, Phase 4).

## [2026-09-27T07:37:35+00:00] User confirmed `test/api-harness` decisions

The user approved the branch and kept all three proposals:
1. Tests live in `backend/tests/`.
2. The harness uses `bun test --preload` (no `bunfig.toml`).
3. `// prettier-ignore` on the seed's ticket blueprint table.

## [2026-09-27T07:43:14+00:00] Task 7 (Phase 0d): `test/e2e-harness`

**Dependency (approval already recorded, GUIDELINES.md:78):** the only manifest change is `@playwright/test` **1.63.0** (exact pin, latest) in `frontend` devDependencies. The lockfile also gains its own internal dependencies, `playwright` and `playwright-core` 1.63.0; no other packages. A written reason was added to the README "Dependency additions" section (INSTRUCTIONS.md:37).

**Files:**
- `frontend/playwright.config.js`
- `frontend/tests/e2e/auth.setup.js`
- `frontend/tests/e2e/smoke.e2e.js`
- `frontend/tests/e2e/support/{sessions,fixtures}.js`
- scripts: `frontend` gets `test:e2e`, root gets `test:e2e`

**Design decisions (my proposals, for the user's review):**

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Location (user: "match the reference shape") | A) `frontend/playwright.config.js` + `frontend/tests/e2e/`. B) a root `e2e/` folder with the dependency at the root. C) a separate workspace. | A | Mirrors `backend/tests/` from 0c; the e2e tests drive the frontend; the root and the workspace list stay as in the reference. |
| Artifacts (saved sessions, results) | A) `frontend/node_modules/.cache/e2e/` (already ignored). B) new `.gitignore` lines. | A | `.gitignore` stays close to the reference; `node_modules/.cache` is a common tool-cache convention. |
| Test file naming | A) `*.e2e.js` via `testMatch`. B) Playwright's default `*.spec.js`. | A | `bun test` auto-discovers `*.spec.*`, so a stray root-level `bun test` could pick up browser tests; `.e2e.js` avoids that. |
| webServer | `bun start` from the repo root, health URL through the Vite proxy, `reuseExistingServer: true`, 180s timeout | as stated | Uses the real start command. Ports 3000/8000 are fixed by the read-only `vite.config.js`, so a running dev app has to be reused. |
| Saved sessions | Setup project signs each role in through the real login form and saves `storageState`; a still-valid saved token is reused (checked via `/auth/me`) | as stated | Keeps repeated runs under the 10/min login limit (only 1 fresh sign-in per run once sessions exist). |
| Sign-out journey | Fresh context and fresh login, not a saved session | as stated | Logout blacklists the token, which would break the saved sessions for later tests. |
| Browser-error guard | An auto fixture fails any test with a console error, page error, or HTTP 5xx | as stated | Enforces the "no console errors" rule in every e2e test. |
| Workers | 1 | as stated | All tests share one database and one login rate-limit bucket. |

**Journeys:**
- **customer:** nav is exactly Dashboard/Tickets; ticket detail has Public Reply, no Internal Note, no Audit trail.
- **agent:** team nav; Agents page with no Add agent button; canned templates listed; Internal Note tab and canned picker present.
- **admin:** full nav; Add agent; Analytics "Total tickets"; Settings "SLA response targets"; Audit trail on the ticket.
- **sign in and sign out:** from the demo chip.

**Verification:**
- **Warm run** (reusing the running app): **7 passed**. Setup reused all 3 sessions, about 0.2s each.
- **Cold run** (app stopped): Playwright started `bun start` itself (reseeding the DB), signed all roles in fresh, **7 passed**, then stopped the app; ports 3000/8000 were released.
- **Guard proof:** a throwaway spec calling `console.error` failed with "browser errors during the test"; the spec was deleted afterwards.
- **First attempt failed (my test's fault):** `getByRole("heading", { name: "Agents" })` matched both the top-bar h1 and the panel h2. Fixed with `level: 2`.
- API tests: 10/10. Build OK. Prettier `--no-use-tabs` passes on all 5 new files.

**Open points for the user:**
- The e2e runner needs **Node.js 18+**, because the Playwright test runner runs on Node, not on Bun's runtime.
- A **one-time browser download** is needed: `cd frontend && bunx playwright install chromium`.
- A cold `bun run test:e2e` **reseeds the dev database** (same as `bun start`).

## [2026-09-27T07:45:13+00:00] User confirmed `test/e2e-harness` design choices

The user approved the branch and kept all three choices:
- `*.e2e.js` naming
- artifacts in `frontend/node_modules/.cache/e2e/`
- one worker

**User note for Phase 1:** the customer e2e journey passes even though customers still receive internal notes. It only checks that the Internal Note *tab* is hidden, not the note *content*. `fix/internal-notes-leak` must add API and e2e tests that assert internal-note content is absent for customers.

## [2026-09-27T07:47:49+00:00] End of Phase 0: fresh-clone check (acceptance criterion)

**Setup:**
- Stopped the local dev app to free ports 3000/8000.
- Cloned `origin/main` @ `5ea8ea9` into a temp folder in the session scratchpad, outside the repo.

| Step | Command (exact) | Result |
|---|---|---|
| Clone | `git clone …/coderepo-react-node-support-desk.git` | OK. No `.env` files in the clone (nothing secret committed). |
| Install (hackerrank.yml) | `bun install && bash setup.sh --seed` | exit 0. `setup.sh` created `backend/.env` and `frontend/.env` from the examples. Seed OK. No error or warning lines. |
| Start (hackerrank.yml) | `bun start` | Ready in about 4s. `:8000/api/v1/health` returns 200 `{status:ok, database:connected}`; `:3000` returns 200; the `/api` proxy returns 200. Admin, agent and customer logins all return 200. The processes' working directory was the clone. No error or warning lines in the log. |
| Build | `cd frontend && bun run build` | OK |
| API tests | `bun run test` | 10 pass, 0 fail |
| E2E tests | `bun run test:e2e` | 7 passed |
| Hygiene | `git status` after all runs; `git archive HEAD` | Clean tree. Archive is 542,720 bytes (< 5 MB). `GUIDELINES.md` and `skills/` are excluded. |

**Cleanup:**
- Stopped the clone's processes and deleted the clone.
- Restarted the dev app from the main repo.

**Mistake during cleanup (no damage):** my first `pgrep -f "…bun start…"` also matched my own shell, whose command line contained that text, and killed it (exit 144). The ports were confirmed free afterwards. Later stops select processes by working directory and exclude the current shell.

**Result: Phase 0 passes the fresh-clone criterion.** This entry is committed on the first Phase 1 branch (commits never go directly to main).

## [2026-09-27T07:55:13+00:00] Task 8 (Phase 1.1): `fix/register-role`

**Defect (audit, verified live):** `POST /auth/register` accepted `role`, so anyone could self-register as `admin`.

**Fix:**
- `role` removed from the strict register schema.
- The service always creates `role: "customer"`, as a second line of defense.
- Agent and admin accounts still come only from the admin-only Agents page.

**Decision (mine, open to the user's review):**

| Options | Chosen | Why |
|---|---|---|
| A) reject any request containing `role` with 400 `VALIDATION_ERROR`. B) silently ignore `role`. | A | Consistent with the existing `.strict()` schemas (unknown fields are rejected everywhere). An explicit 400 is clearer than a silent downgrade. The frontend never sends `role`. |

**Harness change, `e8d9601` ("capture seed baseline before tests run"):** `bun test` runs files alphabetically, so tests that create data (like this one) would run before `seed.test.js` and break its counts. `setup.js` now snapshots the baseline right after seeding, and `seed.test.js` asserts the snapshot. The same commit is cherry-picked onto the other Phase 1 branches.

**Tests (`backend/tests/auth.test.js`, 5):**
- a new customer registers, is signed in, and has role customer
- `role` set to admin, agent or customer each returns 400 and **no account is created**
- a new customer gets 403 on `/analytics`

**Proof:**
- Before the fix: 3 failed (the self-assigned role tests).
- After the fix: 15/15 pass.
- Prettier passes on the touched files.

## [2026-09-27T08:00:04+00:00] Task 9 (Phase 1.2): `fix/internal-notes-leak`

**Defect:** customers received internal notes. The audit verified this on ticket detail. Writing the tests showed that the **ticket list** and the **ticket returned after a customer reply** leaked too.

**Fix:**
- **Backend:** one `presentTicket(ticket, actor)` in `ticket.service.js` strips `isInternal` replies for customers. It is applied to **every** path that returns a ticket: create, list, detail, update, assign, reply.
- **UI (second line of defense):** `TicketDetail` renders only non-internal replies for customers.

**Decision (mine, open to the user's review):**

| Options | Chosen | Why |
|---|---|---|
| A) filter in the service layer, for every ticket response. B) filter in each controller. C) a Mongo projection per query. | A | Business rule lives in the service (GUIDELINES.md:209); one function covers all 6 paths, so a new endpoint can't forget it. |

**Commit layout:** `ticket.service.js` was not Prettier-clean on main, so it got a separate formatting-only commit (`style: format ticket service…`), keeping the fix diff to the lines that matter.

**Tests:**
- **API** (`backend/tests/internal-notes.test.js`): the agent posts a unique internal note and a public reply on a seeded customer ticket. Then for the customer:
  - detail, list and the reply response must **not contain the note text** (the whole JSON is searched), with no `isInternal` replies, while the public reply is still present
  - a customer can't create an internal note (the flag is forced to false)
  - positive controls: the assigned agent and an admin still see the note
- **E2E** (`frontend/tests/e2e/internal-notes.e2e.js`), as the user asked:
  - the agent posts a timestamped note and public reply through the API
  - **customer view:** the public reply is visible, and the note text and the "Internal Note" label have **0** matches on the page
  - **agent view:** the note is visible

**Proof:**
- Before the fix: API **3 failed** (detail, list, reply response); e2e **customer view failed**.
- After the fix: API 16/16, e2e 9/9.
- Build OK; Prettier passes on the touched files.

**Note:** e2e runs against the dev DB, so each run adds one timestamped note and reply there. `bun start` reseeds, as usual.

## [2026-09-27T08:01:56+00:00] Task 10 (Phase 1.3): `fix/assign-authz`

**Defects (audit, verified live):**
- any agent could reassign **any** ticket, including tickets they can't view
- a malformed `agentId` returned **500**

**User's rule (decision 5b):** agents can assign only tickets they can view; admins can assign any ticket.

**Fix (2 lines):**
- `ticketService.assign` now calls the existing `assertCanView(ticket, actor)`: admins always pass; agents only on tickets assigned to them.
- `assignSchema` validates `agentId` as a 24-hex MongoDB id, so malformed input gets 400 `VALIDATION_ERROR` ("Select a valid agent.").
- The existing `INVALID_AGENT` check still covers unknown, inactive and non-agent ids.

**Branch layout:** cherry-picked the identical baseline commit and the identical `ticket.service.js` formatting commit from `fix/internal-notes-leak`, so the three branches merge in order without formatting conflicts.

**Tests (`backend/tests/assign.test.js`, 8):**
- an agent gets 403 on another agent's ticket, and the assignment is unchanged
- an agent can hand their own ticket to another agent
- an admin can assign any ticket
- a customer gets 403
- a malformed id returns 400 `VALIDATION_ERROR` (was 500)
- an unknown id, an inactive agent (agent5) and an admin's id each return 400 `INVALID_AGENT`
- `afterAll` restores both assignments, and the tickets used avoid the seeded customer's tickets that the internal-notes tests use

**Proof:**
- Before the fix: **2 failed** (cross-agent reassign; malformed id → 500).
- After the fix: 18/18 API, 7/7 e2e.
- Build OK; Prettier passes on the touched files.

**Not changed (for later):** after an agent hands their own ticket to someone else, the ticket view stays open, but they no longer have access, so the next action returns 403. Phase 2 ticket UX could route them back to the list.

## [2026-09-27T11:33:21+00:00] Task 11 (Phase 1.4): `fix/objectid-and-json-errors`

**Defect (verified live before the fix): 9 requests returned 500.**
- malformed `:ticketId` on GET, PUT, replies, assign and audit
- malformed `:agentId` on PATCH `/agents/:agentId/status`
- malformed `:responseId` on DELETE `/canned-responses/:responseId`
- `?assignedTo=not-an-id`
- malformed JSON
- a body over 100 KB

**Fix:**
1. **Route guard:** `shared/middleware/validate-object-id.js`, registered with `router.param` for `ticketId`, `agentId` and `responseId`, rejects malformed ids with 400 `INVALID_ID` before any database call.
2. **Error handler backstop:**
   - Mongoose `CastError` / `BSONError` → 400 `INVALID_ID` (covers ids in query strings and any future path)
   - body-parser `entity.parse.failed` → 400 `INVALID_JSON`
   - `entity.too.large` → 413 `PAYLOAD_TOO_LARGE`
   - No internals leak into responses.

**Decisions (mine, open to the user's review):**

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Status for a malformed id | A) 400 `INVALID_ID`. B) 404. | A | It is invalid input, not a missing resource (GUIDELINES.md:205-207). A well-formed id that doesn't exist still returns 404. |
| Where to validate | A) `router.param` guard plus an error-handler backstop. B) a Zod rule in each controller. | A | One place per router, and the backstop means a new endpoint can't regress to 500. |
| Order vs role checks | `router.param` runs before the route's `requireRole`, so a malformed id returns 400 even for a role that would get 403 | accepted | Id format isn't sensitive information. |

**Commit layout:** `error-handler.js` was not Prettier-clean on main, so it got a separate formatting-only commit.

**Tests (`backend/tests/errors.test.js`, 11):**
- 7 URL-id cases
- a well-formed missing id → 404
- the query-string id
- malformed JSON
- a 120 KB body
- each checks status + code **and that no stack, CastError or BSON text is in the response**

**Proof:**
- Before the fix: **10 failed** (the 404 test already passed).
- After the fix: API 40/40, e2e 9/9, build OK.
- Live re-probe of all 9 requests: 400/413 with the expected codes.

**Not changed (for later):** `GET /tickets/<well-formed missing id>/audit` returns 200 `[]` instead of 404 (admin-only, low impact).

## [2026-09-27T11:36:27+00:00] Task 12 (Phase 1.5): `fix/agents-list-inactive`

**Defect (audit, verified live):** `GET /agents` returned only **active** agents (4 of 5), so a deactivated agent disappeared from the Agents page and the **Activate** button could never be reached.

**Fix:**
- **Repository:** `authRepository.findAgentsWithWorkload({ activeOnly = true })`. Auto-assignment keeps the default (active only).
- **Service:** `agentService.listWithWorkload()` asks for all agents.
- **UI:** the ticket assignee picker shows active agents only. If the ticket's current assignee is inactive, they appear as a disabled "Name (inactive)" option, so the select never shows a blank value.

**Decision (mine, open to the user's review):**

| Options | Chosen | Why |
|---|---|---|
| A) one list endpoint returns everyone; the picker filters active agents in the UI. B) add an `?active=true` query to the API. | A | The Agents page needs everyone anyway. Auto-assignment already uses an active-only query on the backend, so no extra API surface is needed. |

**Commit layout:** `auth.repository.js` was not Prettier-clean on main, so it got a separate formatting-only commit.

**Tests:**
- **API** (`backend/tests/agents.test.js`, 5):
  - the list includes all 5 agents, with `isActive` and `openTicketCount`, and no password field
  - agents can read the full list too
  - deactivate agent4: stays listed as inactive; reactivate works
  - activating the seeded inactive agent5 works
  - auto-assignment never picks an inactive agent
  - `afterAll` restores agent4 active and agent5 inactive
- **E2E** (`frontend/tests/e2e/agents.e2e.js`, 2):
  - as admin: Sofia Rossi (inactive) is listed; **Activate** makes her active; **Deactivate** (confirm dialog accepted) restores her
  - the ticket assignee picker offers no inactive agent

**Proof:**
- Before the fix: API **3 failed**; e2e reactivation journey **failed**.
- After the fix: API 34/34, e2e 11/11.
- Build and Prettier OK. The dev DB still has agent5 inactive after the run.

## [2026-09-27T11:41:23+00:00] Task 13 (Phase 1.6): `fix/analytics-range`

**Defects (audit, verified):**
1. The end date was compared at midnight, so **the end day was excluded**. The e2e run showed the 7D preset at 13 vs 20 for all time.
2. An invalid date was silently ignored (200).
3. The dashboard was cached for 60s with **no invalidation**. In the e2e run, "All time" showed 20 right after a ticket was created (it should have been 21).

**Fix:**
- **Controller:** `dateFrom` / `dateTo` must be real `YYYY-MM-DD` calendar dates, with the start on or before the end; otherwise 400 `VALIDATION_ERROR`.
- **Service:** ranges are whole UTC days, from the start of `dateFrom` to the end of `dateTo` (inclusive). The repository uses `$gte` start and `$lt` the next day.
- **Cache:** a version counter (`analytics:version`) is part of every cache key. `analyticsService.invalidate()` bumps it after every ticket create, update, assign and reply, and after an SLA sweep that marks breaches.
- **UI:** the From/To pickers get `max` / `min`, so you can't pick an inverted range.

**Bug caught by the tests during the fix:** my first calendar check called `toISOString()` on an Invalid Date. Zod v4 still runs `.refine` after the regex fails, so `?dateFrom=not-a-date` returned **500** (RangeError). I made the check safe (NaN guard) and the test passed.

**Decisions (mine, open to the user's review):**

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Cache invalidation | A) version counter in the key (O(1); old keys expire in 60s). B) SCAN + DEL `analytics:*`. C) drop the cache. | A | Constant cost per write; keeps the 60s cache the spec asked for. |
| Where to invalidate | A) explicitly in `ticketService` after each write. B) Mongoose post-save hook on the model. | A | Business rules stay in services (GUIDELINES.md:209); the model stays free of Redis. |
| Time zone of a "day" | UTC (the presets already use `toISOString().slice(0,10)`) | UTC | Matches the frontend presets. A user far from UTC may see day edges shifted; noted for the theme / UX pass. |

**Commit layout:** `analytics.repository.js` was not Prettier-clean on main, so it got a separate formatting-only commit.

**Tests:**
- **API** (`backend/tests/analytics.test.js`, 7):
  - a range ending today includes today's ticket; 7 days equals all time
  - `not-a-date`, `2026-02-30` and an inverted range each return 400
  - a new ticket shows up immediately; resolving a ticket updates `resolvedCount` immediately
- **E2E** (`frontend/tests/e2e/analytics.e2e.js`): the "Total tickets" value for 7D equals All time.

**Proof:**
- Before the fix: API **7 failed**; e2e **failed** (13 vs 20).
- After the fix: API 36/36, e2e 10/10, build OK, Prettier OK.
- Live: 400/400/400 for bad input, 200 for a valid range.

## [2026-09-27T11:47:23+00:00] Task 14: `fix/audit-404` (user follow-up)

**Request:** the audit trail for a well-formed but non-existent ticket should return 404 (it returned 200 `[]`), with a test.

**Placement (the user allowed either):**
- the audit fix gets its own tiny backend branch
- the "Dates in UTC" analytics hint goes into `fix/app-shell-layout` with the other frontend work

**Fix:**
- `ticketRepository.exists(id)` (`Ticket.exists`, no populate)
- `ticketService.getAuditTrail` throws 404 `TICKET_NOT_FOUND` when the ticket doesn't exist

**Tests (`backend/tests/audit.test.js`, 2):**
- an existing ticket's trail contains `created`
- the all-zero id returns 404 `TICKET_NOT_FOUND`

**Proof:**
- Before the fix: the 404 test **failed**.
- After the fix: API 54/54, e2e 12/12, build OK, Prettier OK.

## [2026-09-27T12:04:16+00:00] Task 15: `fix/app-shell-layout` (items 1, 2, 4-7 + UTC hint done; item 3 awaiting the user's pick)

**Root cause of items 1-2 (measured in Chromium with a long conversation):**
- `html` scrolled to 2051px while `body` / `#root` / the shell were 961px.
- `overflow-x: hidden` on `html` and `body` turns both into vertical scroll containers, so there were **two scrollbars**.
- The visually-hidden form labels (`position: absolute`, no positioned ancestor) were placed relative to the page. The one inside the reply form (y = 2051) stretched the document.
- Scrolling the page moved the whole 961px shell up, so the sidebar seemed to "stop" partway down.

**Fix:**
- `overflow-x: clip` on html/body
- the shell `100dvh` (fallback `100vh`) with `overflow: hidden`
- `.app-main` / `.app-content` `min-height: 0`
- `.app-content` `position: relative` (the only scroll area)
- mobile keeps the same model: the nav is one compact row, the content scrolls

**Items 4-7:**
- **Sidebar:** 240px, nav items 36px with 2px gaps. `«` collapses it to a **72px icon rail** (every control keeps a `title` tooltip; sign-out stays available in the rail), remembered in localStorage (`support-desk-sidebar-collapsed`). On mobile the sidebar is always a full-width row.
- **Side column:** sticky (`top: 16px`) at >900px.
- **Reply composer:** pinned (sticky bottom) at >900px; a **"Jump to reply"** button (focus + scroll) at ≤900px.
- **Top bar:** shows `#<last 6 of id> · <title>`, matching the number format in inbound-email confirmations, truncated with an ellipsis.
- **Categories:** title case in Ticket info, the New Ticket options and the Settings chips. Canned-response tags keep the app-wide uppercase tag style.
- **Analytics:** "Dates in UTC" hint.

**Note on "sidebar ~360px":** measured, the app sidebar was already 240px; the 359px element is the ticket side column. The collapse, rail and spacing work was done as asked.

**Decisions (mine, open to the user's review):**
- Reply reachability: **both** options, depending on width. A pinned composer on wide screens (zero clicks); on phones a pinned 220px composer would take too much of the screen, so it's a Jump button instead.
- One hard-coded shadow color I added was removed again, since the theme refresh will tokenize everything.

**Tests (`frontend/tests/e2e/layout.e2e.js`, 6):**
- at 1920x961 and at 375x812: the shell equals the viewport height, the document doesn't scroll, and the only scroll area is `app-content`
- side column and reply box in view after scrolling (desktop)
- top bar `#xxxxxx · title` and category `^[A-Z][a-z]+$`
- 240 → 72 rail, remembered after reload, tooltip present, expands back
- UTC hint
- mobile: Jump to reply focuses the field in view
- a long conversation is simulated by cloning message cards **in the page (no DB writes)**

**Proof:**
- Before: **6 failed** (for example "document scrolls: true", "shell 3600 vs 812" on mobile, top bar "Ticket", no UTC hint).
- After: all pass.
- `internal-notes.e2e.js` now targets the panel heading with `level: 2`, because the top bar h1 also contains the title.

**Results:** API 52/52. E2E: 18/18 on 2 full runs; **1 intermittent failure** in the agent smoke journey on an earlier full run (a `toBeVisible` timeout, 16s, not reproduced). Its artifacts were overwritten by a rerun, so the cause is not known yet. Build OK; Prettier OK.

**Commits (local, not pushed yet):** `3e8a1a9` style (formatting-only for NewTicketModal / SettingsPage, which were unformatted on main), `ad910f3` fix, `268f0c1` test.

**Item 3 (e2e test DB): options proposed to the user, waiting for a pick:**
- **A) Stop-and-swap** on 3000/8000: the e2e run stops the dev app (processes on those ports inside this repo), starts `bun start` with `MONGODB_URI=…/support_desk_test` + `REDIS_URL=…/2` (env overrides beat `.env`; `setup.sh` seeds the test DB), then shuts it down afterwards. Pros: uses the real start command. Cons: kills the user's dev session every run; can't develop and test at the same time.
- **B) Parallel isolated stack** (recommended): the e2e run starts its own backend on **8100** (test DB + Redis index 2, seeded first) and Vite on **3100** (`--port` flag) with `VITE_API_URL=http://localhost:8100/api/v1`. The dev app keeps running and nothing read-only changes. Cons: not literally `bun start`, and the browser calls the API cross-origin (CORS is open today; `fix/hardening` must allow the test origin via env).
- **C) Guard only:** e2e refuses to run unless the app on 3000 reports a test database (health would expose `database: "support_desk_test"`); the user stops the dev app and starts a test one manually. Cons: manual steps, and it adds DB info to health.
- Shared DB caveat for A/B: the API tests also use `support_desk_test` and reseed it, so running both suites at the same moment would collide; sequential runs are fine. A separate `support_desk_e2e` is possible if preferred.

## [2026-09-27T12:43:16+00:00] Task 15 (cont.): e2e isolation, flaky-test root cause, ticket detail redesign

**User decision (item 3):** option 2, a parallel test app on 3100/8100 with its own database, `support_desk_e2e`. Reason given: the dev app keeps running and its data is never touched.

**Built:**
- `backend/tests/e2e-server.js` refuses any database name not ending in `_e2e`, seeds with the real seed script, runs `FLUSHDB` on Redis index 2, then imports the real `src/index.js` on port 8100.
- The Playwright `webServer` runs that server plus the frontend on 3100 with `VITE_API_URL=http://localhost:8100/api/v1`.
- All e2e URLs are centralized in `support/sessions.js` (`APP_URL` / `API_URL`).
- The shared fixture now fails any test whose page requests `localhost:3000` / `8000`.

**Proof:**
- Dev DB fingerprint unchanged (same user ids) across a full e2e run.
- `support_desk_e2e` seeded and used.
- The dev app stayed up; 3100/8100 were released afterwards.

**Flaky agent-journey investigation (root cause):**
- A later full run failed a *different* test (the sidebar rail).
- The retained trace showed the timeout on the width poll right after `page.reload()`: in 5s only one measurement happened, because the reloaded app hadn't rendered yet.
- Pattern across both failures: 14-18s tests (normally about 3s) and 2-3 minute runs. The Vite **dev** server compiles modules on demand for each page load, and under load (dev app + e2e app + Chromium on WSL2) some loads went past the 5s expect timeout.
- **Fix:** e2e now runs against a **production build** (`vite build` + `vite preview` on 3100). Pages load one bundled file, which is also closer to what users get.
- **Result:** 3/3 full runs green (46-67s, was 2-3 min), and `smoke` + `layout` `--repeat-each=5`: **53/53**.
- **Decision (mine):** a prod build rather than longer timeouts, which would only hide slowness. Trade-off: React dev-only warnings no longer surface in e2e.

**Ticket detail redesign (user spec, current colors):**
- **Header:** pinned: back button, `#number`, title (ellipsis), status/priority badges (smaller) + SLA chip; the "Opened by" line underneath. It is 76px, flush under the top bar.
- **Conversation:** one `<ol>` list that fills the column (`flex: 1`); no outer panel card, so no box inside a box. Messages use pre-wrap / overflow-wrap (no clipping), 26px avatars, 13-14px text, and a lock SVG replaces the emoji. **Auto-scroll** to the latest message on open and when replies arrive.
- **Composer:** docked at the bottom (sticky) on >900px; tabs; the textarea starts at 2 rows and auto-grows to 200px; compact 30px buttons on one row; the canned list opens upward.
- **Properties:** ONE card with rows for Status, Priority, Assignee (inline selects for staff, title-case values for customers), Requester, Category, Created, SLA due. The admin audit trail is a collapsible inside the same card.
- **≤900px:** one column, Properties first, header not pinned, "Jump to reply" kept. Message headers wrap so the author name never disappears (a 375px bug found in my own screenshot review).
- **Key constraint:** the existing layout tests require exactly one scroll area (`.app-content`). So the design pins the header, properties and composer with sticky positioning inside that one scroll area, instead of giving the conversation its own scrollbar.
- **Bug found by measurement:** Chrome places sticky elements inside the scroll area's padding, which pushed the header 24px down over the "Conversation" label and would have let messages peek under the docked composer.
  - First fix: a modifier class on `<main>`. That broke 2 layout tests, which compare `className` exactly.
  - Final fix: `.app-content:has(> .ticket-detail)` drops the vertical padding; there are no markup changes and the tests are untouched.
- **Verification:** API 52/52; e2e 18/18 (+6 opt-in screenshot tests skipped); build OK; Prettier OK.
- **Screenshots:** in `../screenshots/ticket-detail-redesign/`, captured with `E2E_SCREENSHOTS=1` in the isolated e2e app, with a realistic 6-message thread including one internal note, so no dev data was written.

**Commits (local, NOT pushed; waiting for the user's OK):**
- `262eff5` test (e2e isolation)
- the redesign `feat` commit
- the screenshots `test` commit

**Open points for the user:**
- The top bar and the page header both show the number and title. The top bar could become a breadcrumb later, but the layout test currently asserts it.
- The docked composer leaves empty space above it on short tickets (by design, per "fills the column height").

## [2026-09-28T11:21:01+00:00] Task 15 (cont.): review fixes for `fix/app-shell-layout`

**User feedback (6 items) and what was done:**

1. **Composer covering the last message.** The composer is in the layout flow (sticky), so at the true bottom it can't overlap. The real failure mode is *late layout*: a font or image loads after the auto-scroll, grows the last message, and there's no re-scroll. Fix: a ResizeObserver on the message list re-scrolls while the reader is still at the bottom (within 48px); it stops following once they scroll up.
   - **Decision (mine):** no extra spacer equal to the composer height. The in-flow composer already reserves exactly that space, and a spacer would add an empty gap at the end, which contradicts item 6.
   - Test: grow the last message after opening, then last message bottom ≤ composer top. **It fails on the old code and passes now.**
   - Also tested: a new reply lands above the composer.
2. **Breadcrumb:** the top bar now shows `Tickets / #id`, with "Tickets" going back to the list. The layout test was updated as the user asked: it checks the breadcrumb and the click-through.
3. **Header gap:** the header is now exactly 64px (was 76) and flush under the top bar, with an 8px gap to the conversation (was 12). Test: header height ≤ 66 and gap ≤ 8, which **fails on the old code**.
4. **Timestamps:** regular font, 12px, muted (was monospace 11px). Test: font family not mono, size 12-13px.
5. **Sidebar at 1440-1600:** could not reproduce a thin strip.
   - Measured: expanded 240px and rail 72px at 1440, 1590 and 1600; all 6 nav items visible; the content starts at the sidebar edge; no sideways scroll.
   - Also checked the user's apparent 150% zoom (1042x593 CSS px at 1.5x): no overflow, even after focusing the composer.
   - The left edge of the user's image looks like the sidebar border, which suggests a cropped capture.
   - Added a test at 1440 and 1600, expanded and collapsed: width 240/72, 6 visible nav items, content flush, no sideways scroll.
6. **Short tickets:** the conversation no longer stretches to fill the column, so the composer sits right under the last message and pins to the bottom only once the conversation outgrows the view. Test: gap ≤ 24px, which **fails on the old code**.

**Mistakes on the way (all caught):**
- My first collapsed-sidebar measurement set localStorage after the app had loaded, so it never took effect (fixed with a reload / `addInitScript`).
- A script matched nav text that the rail hides (switched to accessible names).
- The header came out at 67px against the 66px limit (the meta line height); fixed to exactly 64px.

**Results:**
- API 54/54.
- e2e 28 passed + 6 opt-in screenshot tests skipped.
- Build OK; Prettier OK.
- Screenshots in `../screenshots/ticket-detail-redesign-v2/`.

**`fix/audit-404`** was approved and merged to main (5cefc8e) first. This branch was then rebased onto it (local only, never pushed; transcript conflict resolved as a pure append).

## [2026-09-28T11:37:32+00:00] Task 16 (Phase 1.7): `fix/settings-validation`

**Defects:**
- **Partial SLA update wiped the other priorities (found and verified live).** `PUT /settings {"slaHours":{"critical":2}}` stored `{critical:2}` only, because the update replaced the whole nested object.
- SLA hours accepted any positive number (1.5, 10000).
- Categories accepted duplicates, any length, any count, and could be emptied.
- An empty body was accepted.
- Every validation error said only "Request validation failed."

**Fix:**
- **Schema:** SLA hours are whole numbers 1-720 (30 days), with unknown priorities rejected. Categories: 1-20 names, trimmed, 1-30 characters each, stored in lower case (shown in title case), unique ignoring case. At least one of `slaHours` / `categories` is required.
- **Service:** builds a `$set` with dot paths (`slaHours.critical`), so a partial update keeps the other priorities (repository `setDefaultsOnInsert`).
- **Error handler (shared):** `VALIDATION_ERROR` now carries the first issue's message (for example "Keep at least one category."); the full field details stay in `details`. This improves every form's feedback.
- **Settings page:** mirrors the rules ("Use whole hours.", "Must be 720 hours (30 days) or less.", "You can have up to 20 categories.") plus `max` / `step` on the inputs.

**Decisions (mine, open to the user's review):**
- **Limits:** 720h and 20 x 30-char categories are generous product limits; easy to change.
- **Lower-case storage:** avoids "Billing" vs "billing" duplicates; the UI already title-cases.

**Tests:**
- **API** (`backend/tests/settings.test.js`, 16): partial update, trimming / lower case, admin-only, 12 invalid shapes with exact messages, and a rejected update leaves the settings unchanged.
- **E2E** (`frontend/tests/e2e/settings.e2e.js`, 2): inline errors for 1.5 and 721 with nothing saved; a valid change persists after reload and the other priorities are kept.

**Proof:**
- Before the fix: API **14 failed**; the e2e invalid-hours test **failed** on the old page.
- After the fix: all pass.
- My first e2e version failed on the new code too, because after `page.reload()` the app returns to the dashboard (no routing yet). Fixed the test by navigating to Settings again.

## [2026-09-28T11:40:55+00:00] Task 17 (Phase 1.8): `feat/webhook-secret`

**Defect:** `POST /api/v1/webhooks/email` was public: anyone could create tickets and customer accounts (only a 30/min rate limit).

**Fix:**
- `features/webhooks/webhook.secret.js` requires the `X-Webhook-Secret` header to match `WEBHOOK_SECRET`.
- The comparison is **timing-safe on SHA-256 digests**, so neither the content nor the length of the secret leaks through timing.
- Missing or wrong secret → 401 `INVALID_WEBHOOK_SECRET`. If no secret is configured, the webhook **fails closed** with 503 `WEBHOOK_DISABLED`.
- The rate limit runs before the check, which slows secret guessing.
- The secret is read per request with the existing `getOptionalEnv` (no change to the read-only `config/index.js`).
- `WEBHOOK_SECRET` was added to `backend/.env.example` (setup copies it into new `.env` files), plus to the API test setup and the isolated e2e server.
- README: one line documenting the header.

**Decisions (mine, open to the user's review):**

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Unset secret | A) fail closed (503). B) accept everything (current behavior). | A | A missing config must not reopen the hole. |
| Where to read it | A) `getOptionalEnv` at request time. B) add it to `config/index.js`. | A | `config/index.js` is a `hackerrank.yml` read-only path. |
| Signature style | A) shared-secret header. B) HMAC of the body. | A | Simple for the planned in-app simulator; HMAC can come later. |

**Note for Phase 2:** the inbound-email simulator must call the webhook **from the backend** (an admin endpoint), never from the browser, so the secret is never sent to the frontend.

**Local dev note:** the user's existing `backend/.env` predates this variable, so the local webhook returns 503 until `WEBHOOK_SECRET=…` is added. Fresh clones get it from `.env.example`.

**Tests (`backend/tests/webhook.test.js`, 5):**
- no secret → 401
- wrong secrets, including a different length → 401
- the right secret → 201 and the ticket exists
- unset secret → 503
- a rejected request creates no ticket

**Proof:**
- Before the fix: **4 failed** (the matching-secret test passed because the endpoint was open).
- After the fix: API 59/59, e2e 28 (+6 skipped).
- Prettier OK (the gate now requires the check to pass before committing).

## [2026-09-28T11:45:37+00:00] Task 18 (Phase 1.9): `fix/hardening`

**Defects (audit, verified live):**
- registration was not rate-limited
- `Access-Control-Allow-Origin: *` for every origin
- no security headers

**Fix:**
- **Register rate limit:** 10 attempts per 10 minutes per IP (same Redis limiter as login). It runs before validation, so invalid attempts count too.
- **CORS allowlist:** `CORS_ORIGIN` (comma-separated, default `http://localhost:3000`), read with `getOptionalEnv` (no read-only file change). Unlisted origins get no CORS headers, preflight included.
  - The dev app and HackerRank reach the API through the Vite proxy (same origin), so they are unaffected; verified with a browser smoke of the dev app for 3 roles, 0 errors.
  - The isolated e2e app (a real cross-origin browser setup) gets `CORS_ORIGIN=http://localhost:3100` through the Playwright config.
  - Added to `.env.example`.
- **Security headers (by hand, no dependency)** in `shared/middleware/security-headers.js`:
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`
  - COOP same-origin, CORP same-site
  - `Permissions-Policy` (camera, microphone, geolocation off)
  - CSP `default-src 'none'` with `img-src 'self'`, `style-src 'unsafe-inline'` (only for the API's static status page), and `frame-ancestors 'none'`
  - `X-Powered-By` stays disabled.

**Decisions (mine, open to the user's review):**
- **No HSTS:** the app is served over plain HTTP locally and on HackerRank; HSTS belongs at a TLS-terminating proxy.
- **Register limit 10/10min:** blocks scripted sign-ups without hurting a real user who mistypes.

**Tests (`backend/tests/hardening.test.js`, 7):**
- the 11th register attempt → 429 (the test clears its Redis keys before and after)
- the allowed origin is echoed; a foreign origin and a foreign preflight get no header
- headers are present on `/health`, on a 401 route, and on a 404 route

**Proof:**
- Before the fix: **7 failed**.
- After the fix: API 61/61, e2e 28 (+6 skipped); dev-app browser smoke 0 errors.

**Mistake (harmless):** my old scratch smoke script still targeted `.sla-timer-pill`, which the redesign removed. I updated the script (scratchpad only).

## [2026-09-28T11:50:06+00:00] Task 19 (Phase 1.10): `fix/redis-resilience`

**Defects (verified):**
- With Redis down, **signing in returned 500** (the login rate limiter) and every signed-in request failed (the blacklist check).
- Logout silently skipped revocation, so a "signed-out" token stayed valid.
- `setup.sh` exited 1, so neither declared HackerRank command could run without Redis.
- Health didn't report Redis.

**Fix (user decision 5d: keep Redis, degrade gracefully):**
- **Redis client:** `enableOfflineQueue: false` + `maxRetriesPerRequest: 1`, so commands fail fast instead of hanging. Backoff reconnects up to 5s. One log line per state change (not per retry). New helpers: `isRedisReady()` and `withRedis(operation, fallback)`.
- **Caches** (analytics dashboard, settings): skipped while Redis is down; computed from MongoDB.
- **Rate limits:** fall back to per-process fixed-window counters in memory (pruned), so limits keep working.
- **Sign-out:** new `features/auth/token-blacklist.js`. A revoked token is kept in memory (until its expiry) **and** in Redis, so revocation holds while Redis is down and after it comes back.
- **Health:** `{ status, database, redis }`.
  - MongoDB down → 503.
  - Redis down → 200 `degraded`.
  - Both up → 200 `ok`.
- **`setup.sh`:** warns and continues when Redis is unreachable. `REDIS_HOST` / `REDIS_PORT` are now overridable (used to verify this path).
- **README:** the Redis prerequisite now says "recommended rather than required" and describes the degraded behavior.
- **Test harness:** setup waits for Redis `ready` before `FLUSHDB` (commands no longer queue). The smoke test expects `redis: "connected"`.

**Decisions (mine, open to the user's review):**

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Rate limit without Redis | A) fall back to memory counters. B) fail open (no limit). C) fail closed (reject all). | A | Keeps brute-force protection and availability; per-process is enough for a single-instance app. |
| Blacklist without Redis | A) memory copy, always written. B) accept tokens (fail open). | A | Sign-out must always sign out. |
| Health status code when only Redis is down | A) 200 `degraded`. B) 503. | A | The app still serves every feature; 503 would signal "down" to probes. |

**Known limit:** memory fallbacks are per process, so they would not be shared across several API instances; this app runs one. Writes during an outage don't bump the analytics cache version, so after Redis returns a dashboard cached before the outage can be up to 60s stale.

**Tests (`backend/tests/redis-resilience.test.js`, 6):** Redis is taken down *inside the test process* (the app's own client), never the user's container.
- health 200 degraded / disconnected
- signed-in requests < 1s
- analytics and settings read + write
- logout still revokes (401)
- the in-memory rate limit gives 429 on the 31st webhook call
- after reconnecting, health is `ok`

**Proof:**
- Before the fix: failed at setup (sign-in 500 without Redis), and health lacked `redis`.
- After the fix: API 60/60, e2e 28 (+6 skipped).
- **Live:** `setup.sh` with `REDIS_PORT=6390` warned and completed (exit 0, seeding `support_desk_test`, not the dev DB). A real backend on port 8200 with Redis at a dead port gave: health 200 degraded; login 200 (0.21s); tickets, analytics, settings and `/me` 200 (≤0.05s); logout then `/me` → 401. It was stopped afterwards.

## [2026-10-02T13:08:38+00:00] Task 22: compliance and product-rules audit (read-only), stopped and handed to an independent reviewer

**Why this audit:** my previous two HackerRank submissions were rejected. The Postman clone (application 348) failed for an added dependency (axios) and a removed one (Roboto), overflow at 375px, and too few product rules (about 5 rules and 2 multi-record/status screens, against 15 and 6). The PagerDuty clone (application 339) failed for a layout that broke below about 1000px, a "Reopen" action that kept the old escalation clock, no confirmation on a destructive action, real brands and domains, a Google-hosted font, business logic in handlers, only one kind of access rule, unused routes, and demo dates that could not be fixed. I stopped all UI work (`feat/theme-refresh` stays unmerged) and asked for a read-only audit of sections A–I first, with the Discord FAQ basics (testing, responsive UI, correct stack, authentication) checked first.

**My decision to stop:** I stopped the audit partway, before the plan and decisions were finalized, to hand it to an independent reviewer. The reason is the same two rejections: I want a second, independent check before more work is built on it. The partial findings are in a file outside the repo (never committed).

**What was checked (on `main` @ `4789321`, clean clone, exact `hackerrank.yml` commands):**
- Basics: testing ✅ (`bun test` 88/88); responsive 🛑; correct stack 🛑; authentication ✅.
- B: three added packages, `@playwright/test`, `ioredis`, `node-cron` (plus 10 transitive). Versions match the reference; Roboto is bundled locally.
- C (Chromium, every role × page × 1280/1024/900/768/600/375): no page-level overflow anywhere, but there is no menu fold; the admin nav becomes a sideways-scrolling strip at 768/600/375, and at 375 the ticket table shows only Title and Status.
- D: about 7 real product rules today and 2 multi-record/status screens. A list of 22 proposed rules was drafted, not yet reviewed.
- F (bugs I asked to be tested on OLD seeded tickets):
  - reopening a ticket resolved 46 hours ago kept its old SLA deadline, and within 65 seconds the sweep marked it breached and notified the agent (the same bug class as the PagerDuty "Reopen")
  - lowering the priority of a breached ticket cleared the breach
  - skipping open→closed is allowed
  - deactivating an agent left 4 open tickets on them
- G/H:
  - "inspired by Zendesk/Freshdesk" in the README
  - `@supportdesk.io` demo identities
  - two `window.confirm` uses
  - `GET /audit-logs` and `POST /webhooks/email` have no UI
  - seed dates come from `Date.now()`
- I: verifier FAIL on S06, S09, S15, S16, S17; every runtime check (R01–R12) passed.

**Decisions made in this task:**

| Question | Options | My choice | Reason |
|---|---|---|---|
| MongoDB was not reachable | A) start Docker myself; B) download mongod to a scratch folder; C) static checks only | A | Keep the real setup, no extra downloads |
| Uncommitted theme WIP | A) park on a new `wip/` branch; B) commit on `feat/theme-refresh`; C) stash locally | A | The reviewer can see it, and the theme branch stays as pushed. `wip/theme-refresh-uncommitted` is a parking spot only: never merged, tests may be red |
| Where this entry goes | A) `docs/audit-handoff` from main; B) the WIP branch | A | Keeps the transcript separate from parked code |

**No code changed.** Branches: `main` and `feat/theme-refresh` were already pushed and unchanged. `wip/theme-refresh-uncommitted` (948169a) was pushed. `docs/audit-handoff` (this entry) is pushed and waiting for my "approved". The repo is still private.

Note: Tasks 20–21 (theme refresh) are recorded in this file on `feat/theme-refresh`, which is not merged.

## [2026-10-02T13:28:40+00:00] Task 23: independent review, my decisions, and branch 1 `chore/remove-added-deps`

**Why I ran an independent review:** my previous two submissions were rejected, for added dependencies, for the layout, and for too few product rules (about 5, against the 15 rules and 6 workflow screens reviewers count). I didn't want to rely on one audit by the same tool that wrote the code. A separate reviewer checked `main` @ `4789321` (read-only, code and diffs only; it could not run MongoDB).

**What the review found:**
- It confirmed the earlier audit: the 3 added packages; reopen keeping the old SLA deadline; lowering priority clearing a breach; deactivation stranding tickets; brands and `@supportdesk.io`; 2 `window.confirm`; about 7 real rules.
- New findings N1–N9:
  - N1: the status "state machine" allows almost everything
  - N2: illegal moves return 400 instead of 409
  - N3: customers can't close or reopen their own tickets, although I decided they can
  - N4: replies are accepted on closed tickets, and a customer reply on a resolved ticket doesn't reopen it
  - N5: no unassigned queue, so a ticket with no agent is invisible to every agent
  - N6: SLA-breach audit entries are attributed to the customer
  - N7: assignment works on closed tickets and to the same agent, with no "from" in the audit
  - N8: only one kind of access rule
  - N9: seed dates can't be pinned
- Its plan: 17 new rules in 5 groups, a dependency removal plan with no replacement packages, and an 8-branch order.

**Comparison with my partial audit:** N2, N3, N6 and N9 were already in it. N1, N4, N7 and N8 were partly in it. **N5 was missed**, along with parts of N4 (a reply on a resolved ticket doesn't reopen it) and N7 (same-agent reassignment, no "from" in the audit). Where Claude Code disagreed:
- Rule 6 (a customer reply reopens a resolved ticket) must go through the same reopen path as rules 2–3 (window, SLA restart, "reopened" entry), or it becomes a way around the reopen window.
- An in-memory token blacklist means a signed-out token works again after a backend restart. A Mongo TTL collection would avoid that without a package. Recorded as an open question for me.

**My decisions:**

| Decision | Options | My choice | My reason |
|---|---|---|---|
| Dependencies | keep with a written reason / remove with replacements / remove with no replacement packages | Remove `@playwright/test`, `ioredis` and `node-cron`, no replacement packages (section 6) | GUIDELINES.md:65 forbids adding any dependency, and my Postman clone was rejected for exactly this |
| Rules | minimum set (11) / full set (17) | The FULL set of 17 rules from section 5 | Reviewers count about 15 real rules and 6 workflow screens, and my last two submissions had about 5. A helpdesk naturally has these rules (lifecycle, SLA, teams, bulk work), so they make the product more real, not just bigger |
| Second access rule | customer ownership only / agent teams by category | Agent teams by category | Real support teams are split by area like Billing and Technical. It also fixes the missing unassigned queue (N5), and my PagerDuty clone was rejected for having only one kind of access rule |
| Order | — | The review's section 8, one branch at a time, stopping for my approval after each | — |

**Branch 1, `chore/remove-added-deps` (pushed, waiting for my "approved"):**
- Removed `@playwright/test` (config, 11 e2e files, `test:e2e` scripts).
- Removed `ioredis`: rate limits and signed-out tokens are in memory; there is no analytics/settings cache; the health check reports the API and MongoDB like the reference; Redis is gone from `setup.sh`, `.env.example` and `.gitignore`; `config/index.js` is byte-identical to the reference again.
- Removed `node-cron`: the SLA sweep runs every minute on `setInterval` and skips a tick while a sweep is still running.
- The dependency and devDependency sections now match the reference exactly, and `bun.lock` has the reference's package set.
- Tests: the 6 Redis-resilience tests were removed. Added: 4 scheduler tests (interval, no overlap, recovery after a failure, stop/restart), sign-out revocation, and the webhook rate limit.
- **Results:** API 88/88 in the repo and in a fresh clone. Fresh clone: `bun install && bash setup.sh --seed` OK (149 packages, none of the removed ones), `vite build` OK, `bun start` serving on 3000/8000, health `{"status":"ok","database":"connected"}`, sign-out then `/me` returns 401, and the live sweep logged "0 breached, 1 warned" within a minute.

## [2026-10-02T14:35:27+00:00] Task 24: branch 1 merged; my answers; branch 2 `fix/responsive-layout`

**Approved and merged:** `chore/remove-added-deps` and `docs/audit-handoff`, both with `--no-ff` (main is now `034a029`). Both branches were deleted locally and on origin. On main: API 88/88 and the build passes.

**My answers to the open questions:**

| Question | Options | My choice | My reason |
|---|---|---|---|
| The two `test` scripts (the only package.json difference besides name/description) | keep / remove | Keep | Scripts aren't dependencies, and testing is a basic HackerRank requirement |
| Where signed-out tokens are stored | in memory (review section 6) / MongoDB with a TTL index | MongoDB with a TTL index, no new package, built in the branding/hygiene branch | A restart must not undo a sign-out |
| The three disagreements with the review | — | Agree with all three | (1) A customer reply on a resolved ticket goes through the same reopen rules: the 14-day window, the SLA restart, and the "reopened" log. (2) Internal notes must not change a ticket's status. (3) Fix the 3 seeded deadlines and the late-resolved ticket in the seed |

**Branch 2, `fix/responsive-layout` (my requirements):**
- Content fills the screen at 1280, 1024, 900, 768, 600 and 375px, for every page and role.
- Below about 1000px the sidebar folds into a menu: a hamburger opens a full-height drawer with a backdrop, and there is never a thin strip or sideways-scrolling tabs.
- At 375px the dashboard, the ticket list (as stacked cards, not a squeezed table) and the ticket detail are fully usable.
- No visual polish beyond that.
- `scrollWidth === viewport width` is measured with a temporary script outside the repo, adding no dependency.

**What changed:**
- Below 1000px, a menu button opens the drawer. Escape, the backdrop, a close button or picking a page closes it. Focus moves into the drawer and returns to the menu button, and the page behind is inert.
- The old 768px row of sideways-scrolling nav tabs is gone.
- At 720px and below, the ticket, agent and analytics tables become labeled cards, with a "Sort by" select replacing the hidden headers.
- Tables no longer force a 640px minimum width.
- Long titles wrap on phones.

**How it was measured:** a script in the session scratch folder (not in the repo, no npm package). Node's built-in `WebSocket` drove a local Chromium through the DevTools protocol, covering every role × page × width plus the login page (120 measurements) and the open drawer at 900/768/600/375 for each role (12).

**Bugs found while measuring (fixed on this branch):**
- Focus did not move into the opened drawer, because its visibility transition kept it hidden for the first frame.
- The ticket table still scrolled sideways by 17–25px inside its container at 1024 and 768px.
- On phones, the ticket title was cut off and the dashboard rows squeezed their titles.

**Result:**
- 120/120 measurements with `scrollWidth` equal to the viewport, nothing clipped, no inner sideways scrolling, no off-screen controls, 0 console errors.
- 12/12 drawer checks: full height, backdrop covering the page, no sideways nav, focus in and back, Escape closes.
- API 88/88, build OK, Prettier OK on the changed files.

## [2026-10-02T15:51:00+00:00] Task 25: rect check before approval, merge of `fix/responsive-layout`, and branch 3 `fix/branding-and-hygiene`

**My extra check before approving the layout:** `.app-shell` has `overflow: hidden`, which can hide clipped content from the `scrollWidth` check; my Postman clone was rejected for exactly this. I asked for a second check, at all 6 widths for every page and role, including inside the open drawer and dialogs: no visible element's `getBoundingClientRect().right` may exceed `window.innerWidth`, and no `left` may be below 0.

**Result:**
- 228 states checked (114 pages, 72 open drawers, 24 dialogs, 18 notification panels), covering 27,365 visible elements: 0 offenders, 0 console errors.
- A negative control proved the check works. A 600px element inside an `overflow: hidden` container at 375px passes `scrollWidth === innerWidth` (375 = 375), but the rect check reports it (`div.too-wide[0,600]`).
- So `fix/responsive-layout` was merged with `--no-ff` (main `364915e`), and the branch was deleted. On main: API 88/88, build OK.

**My decisions:**
- The drawer below 1000px and cards at 720px and below are fine.
- The old icon-rail rule in `../support-desk-rules.md` is replaced by the drawer rule plus the rect check.

**Branch 3, `fix/branding-and-hygiene` (my list):**
- **Brand and domain:** "inspired by Zendesk/Freshdesk" is removed. `@supportdesk.io` becomes `@example.com` everywhere (seed, login chips, placeholders, tests, README). Earlier transcript entries are left as written, because they are append-only.
- **Confirmation dialog:** both `window.confirm` calls are replaced by `ConfirmationDialog`, with a title, a consequence line, a danger style, Cancel focused first, Escape, and focus returned to the trigger.
  - Bug found while testing: focus did not return. React StrictMode ran the dialog's effect twice while the native modal kept the page inert, so the dialog's own Cancel button was recorded as "previously focused". Fixed in `Modal` by closing the dialog before restoring focus.
  - Checked in the browser 18 times (Deactivate agent, Delete template; 3 roles; 6 widths): all pass.
- **Signed-out tokens in MongoDB** (my decision; reason: a restart must not undo a sign-out):
  - Only SHA-256 hashes are stored, with a TTL index on `expiresAt`.
  - Test: a separately started process (a real restart, no shared memory) refuses a signed-out token. The old in-memory version would fail this.
- **SLA-breach audit entries** are recorded as the system (`performedBy: null`, shown as "System"), not the customer. Covered by a test.
- **Seed:**
  - Deadlines now follow the seeded SLA hours; 3 tickets were wrong.
  - "Duplicate charge on my card" was resolved late and is now marked breached.
  - Breach alerts are seeded only for open tickets, and seeded assignment entries name the agent.
  - 3 seed tests guard this.
- **Unused routes** (Claude Code chose; I asked to be told which and why):
  - `GET /audit-logs`: kept, with a new admin **Activity** page (every ticket change, newest first, paged, each row opening its ticket). It's the "History and auditability" pattern, and the backend already existed.
  - `POST /webhooks/email`: removed. It needs an outside mail sender (GUIDELINES.md:186), and a browser screen for it would expose `WEBHOOK_SECRET` or need a second endpoint that becomes the real consumer. Tickets are already created in the app.
- **Dead code and formatting:** dead code is removed, and the 5 failing files pass Prettier. All backend and frontend source now passes `prettier --check --no-use-tabs`, apart from the reference-identical, tab-indented `config/index.js`.

**Result:**
- API 92/92 (+3 activity-log, +2 revocation, +1 SLA attribution, +3 seed; −5 webhook).
- Rect and layout check: 256 states with 0 offenders, 0 console errors, all 18 dialog checks passing, and an Activity row opens its ticket.
- Fresh clone: install, seed, build and tests OK.
- One check run crashed once with "no app shell" on a page. It did not reproduce in 2 full reruns; the probable cause is a Vite cold-start reload (not verified).

**Read-only config files (on `fix/branding-and-hygiene`, before merge):**
- `hackerrank.yml` lists `backend/src/shared/config/database.js` and `frontend/vite.config.js` as read-only. Both differed from the reference (formatting only).
- Both were copied byte-for-byte from `../coderepo-react-node-calendar-reference` and added to `.prettierignore` (Prettier would reformat both). `cmp` confirms all three read-only config files (`database.js`, `index.js`, `vite.config.js`) match the reference.
- Re-run: API 92/92, `vite build` OK.
- Found while checking: `backend/src/scripts/seed.js` also differs from the reference. It is the Support Desk seed, so it must differ. Not changed; flagged for the user.

**My decisions (with my reasons):**
- Activity page for `/audit-logs`: approved. It adds the "History and auditability" capability from REQUIREMENTS.md.
- Removing the email webhook: approved. It needs an outside mail sender (GUIDELINES.md:186), and the secret cannot go to the browser.
- Merge: waits for my "approved" (my own footer rule), even though the task text also lists the merge steps.

**Approved: merge of `fix/branding-and-hygiene` (my decisions, with my reasons):**
- `backend/src/scripts/seed.js` stays as is. Reason: it is our product's seed; the read-only path only protects it from candidates during the assessment, so it is not meant to match the reference.
- Merge with `--no-ff`, push `main`, delete the branch locally and on origin, run all tests on `main`.

---

## Task: functional QA sweep (branch `fix/functional-qa`, 2026-10-03T05:33:40+00:00)

**What I asked for:** nine bugs I found in my own manual testing, then a full QA sweep of every flow
for admin, agent and customer at 1280 and 375, with every high and medium finding fixed on this
branch and the low ones listed for me to decide. No new dependencies, no visual redesign.

**New standing rule I set (saved to the rules file as "Definition of Done"):** a feature is done only
when it works end to end: reachable UI for every role it applies to, a real validated API call with
the right status code, data that survives a refresh and a server restart, loading/empty/error/success
states with no flicker, 1280 and 375 in both themes, tested on old seeded records, and a `bun test`
for its backend behavior. Nothing half-built ships; if it cannot be finished properly it is removed
and reported.

### Decisions I made on this branch, with my reasons

| Decision | Options | My choice and why |
|---|---|---|
| How search should match | Mongo `$text` (whole words, indexed), or a regex over title and description | **Regex, escaped and case-insensitive.** `$text` cannot match inside a word, which is the bug I reported ("voice" never found "Invoice"). The term is escaped so `(` or `*` is searched for literally. The now-unused text index was removed rather than left behind. |
| Where sorting happens | Keep sorting the page in the browser, or sort in the database | **In the database.** Sorting the rows on screen silently reorders one page of a longer list, so page 2 made no sense. Priority and status are word enums, so the repository adds a rank for them and lowercases titles, and one sort key drives both the column headers and the "Sort by" select. |
| Reopening an old ticket | Leave the deadline measured from creation, or restart the clock | **Restart it,** stored in a new `slaStartedAt` field. This is the same bug class that got the PagerDuty submission rejected: an old ticket came back from "closed" already breached. Tested on seeded tickets that are days old, not only on fresh ones. |
| Illegal status move | Keep 400, or 409 | **409.** The input is well formed; it conflicts with the state the ticket is in. 400 stays for a value outside the status list. |
| Who may raise a ticket | Leave the API open to every role, or restrict it | **Customers only.** The UI already showed "New ticket" to customers on the dashboard but to everyone on the ticket list. Rather than make the dashboard match the list, I made both match the product: customers raise tickets, staff work them, and the API now says so with a 403. |
| Dashboard numbers | Keep counting the rows already fetched, or ask the server | **Ask the server,** on a new `GET /tickets/stats` scoped by role. The tiles counted one page of tickets and inherited whatever filter was last used on the ticket list, so the home page reported different numbers depending on where you had been. |
| Status wording | Title-case everything including badges, or leave the badge styling alone | **Labels are title case everywhere; badge styling untouched.** Badges are uppercased by a CSS rule that is part of the existing design system, and I asked for no visual redesign. Every label that is not a badge now reads "In Progress", including the status filter, the sort options and the notification text. |

### Bugs the sweep found that I had not reported

- The **agents list flashed "No agents yet"** before its first request even started, because the
  skeleton was tied to "a request is in flight" rather than "no answer yet". Fixed for every list.
- **Analytics swallowed errors** once numbers were on screen: a failed range change left stale
  figures with nothing to explain them. The error is now shown above the dimmed figures, with Retry,
  and a backwards date range is refused in the page instead of being sent to the server.
- An aggregation does not cast id strings the way a query does, so the first version of the
  database-side sort returned **empty lists for agents and customers**. The existing tests caught it;
  the repository now casts the filter before aggregating.

### What I decided not to do on this branch

- **Deep links / Back button.** A refresh keeps you signed in but lands on the dashboard, and the
  browser Back button leaves the app. Hash routing is already approved as its own Phase 2 item, and
  rebuilding navigation inside a QA branch is the kind of architecture change I ask about first.
- **Customers closing and reopening their own tickets** (my decision 5a). The server forbids it today
  and no screen offers it, so it is consistent rather than half-built. It needs its own branch.

### My decisions on the low findings (2026-10-03T05:38:14+00:00)

I approved the branch and decided each low item, with my reasons. None of them is dropped; each has a
named branch so it cannot quietly disappear.

| Item | My decision | My reason |
|---|---|---|
| L1 refresh / Back | Fix it with **hash routing** (already approved, no new package), on its own branch `feat/hash-routing`, **after** `feat/ticket-lifecycle` | A reviewer refreshes the page or presses Back within a minute of opening the app. Landing back on the dashboard, or leaving the app entirely, reads as broken. |
| L2 customer close / reopen | Build it in `feat/ticket-lifecycle` | It is my decision 5a and the server already restarts the SLA clock correctly, so the rule is ready for a screen. |
| L3 admin notification bell | Admins get notified of **SLA breaches** and of **tickets with no assignee**, in `feat/ticket-lifecycle` | An always-empty bell looks broken. These are the two things an admin actually needs to act on. |
| L4 handing a ticket away | Return the agent to the ticket list with a toast **"Ticket handed to <name>"**, in `feat/ticket-lifecycle` | The agent loses access the moment they reassign, so leaving the ticket on screen until the next click is misleading. |
| `seed.js` one-line edit (`slaStartedAt`) | Approved | It is our product's seed; the read-only path only protects it from candidates during the assessment. Decision already recorded on the previous branch. |

**Merge:** `fix/functional-qa` merged into `main` with `--no-ff`, branch deleted locally and on origin,
all tests re-run on `main`.

---

## Task: `feat/ticket-lifecycle` - the ticket state machine as real product rules (2026-10-03T07:01:53+00:00)

**Criteria this branch improves:** functionality (every lifecycle move now behaves the same in the UI
and the API), production readiness (eight server-enforced rules with the right status codes),
testing (two new test files, 173 tests in total), code architecture (the rules live in one pure
module, not in the request handlers).

Eight rules I asked for, plus the four follow-ups queued from the QA sweep. The rules sit in a new
`backend/src/features/tickets/ticket-lifecycle.js`: a pure module with no database access, which the
service calls. The ticket page asks the API what the viewer may do, so a control is never offered for
a move the API would refuse.

### The lifecycle I chose

```text
open -> in_progress -> pending <-> in_progress -> resolved -> closed
                                                     |           |
                                                     +-> open <--+   (reopen, 14 days)
```

### Decisions on this branch

| Decision | Options | What I chose, and why |
|---|---|---|
| Where the rules live | Spread through `ticket.service.js`, or a separate module | **A separate `ticket-lifecycle.js` with no database access.** The service reads as a sequence of decisions, and every rule can be tested and reasoned about on its own. It is also the direct answer to the PagerDuty rejection note "business logic in the request handlers". |
| How the UI learns the rules | Mirror the transition table in the frontend, or have the API say what is allowed | **The API returns a `permissions` block on the ticket detail.** A mirrored table in the frontend is a second source of truth that drifts. The status control now offers exactly the moves the server accepts, and every disabled action carries the server's own reason. |
| Error code for an illegal move | Keep `INVALID_STATUS_TRANSITION`, or rename to `INVALID_TRANSITION` | **Renamed to `INVALID_TRANSITION`**, the code I asked for. One name in the API, the tests and the README table. |
| `pending -> resolved` | Allow it, or force a step back through in progress | **Force the step.** "No skipping" has to mean something; a pending ticket is waiting on the customer, so somebody has to pick the work back up before it can be called resolved. |
| A customer's reply on a **pending** ticket | Move it to in progress with the clock untouched, or treat it as a reopen | **Treat it as a reopen,** as I asked: a fresh SLA window from the reply, the breach and warning flags cleared, and a `reopened` entry. While a ticket is pending the team is waiting on the customer, so the clock should not keep running against them for the customer's own delay. This is the one place where a breach flag is cleared by something other than an explicit reopen; rule 7's "a breach is permanent" is about **priority changes**, which never clear it. |
| What `closedAt` does for old records | Add the field and accept that old tickets have none, or fall back | **Fall back to the resolve stamp, then to the last write.** The 14-day window has to be measurable on records written before the field existed. There is a test that unsets `closedAt` on a seeded ticket and proves the window is still enforced. |
| Who may close a ticket | Let a customer close from any status, or only from resolved | **Only from resolved,** because "no skipping" applies to them too. A customer closes a ticket the team has already resolved, or reopens it; everything else on the board is the team's. |
| The status history | Reuse the admin audit trail, or a separate endpoint | **A separate `GET /tickets/:id/history`** for anyone who can see the ticket, carrying lifecycle entries only. The full audit trail stays admin-only because it names internal activity. |
| Seeded tickets' history | Leave them with one "Opened" line, or seed the moves | **Seed the moves.** A seeded resolved ticket whose history showed only "Opened" made the feature look broken on exactly the data a reviewer opens first. The seed now writes the moves that must have happened to reach each seeded status. |
| Reaching 15+ rules | Build everything in the independent review, or the lifecycle set first | **The lifecycle set first.** It is the one a reviewer exercises by clicking through a ticket, and it covers the "action did the wrong thing on an old record" rejection directly. |

### Changes from the approved proposal: my decision, and why

I asked for these to be recorded as my own calls rather than as things that quietly did not get
built. In every case the submission guidelines and the proposal disagreed, and **the guidelines win**
(my standing rule). The README now carries the same table so a reviewer sees it without reading the
transcripts.

| Proposal item | What we built | My reason |
|---|---|---|
| TypeScript | JavaScript with ES modules | The reference calendar repo is JavaScript and the sample stack is kept as declared (`AGENTS.md:238`). TypeScript would also mean new build dependencies, and `GUIDELINES.md:65` forbids adding any. |
| Redis caching | No caching layer at all | `GUIDELINES.md:65`. `ioredis` is not in the reference repo. I would rather answer every request from MongoDB than add a dependency that could fail the submission outright, and dropping the cache removed a class of stale-data bugs. |
| WebSockets | Polling every 15 seconds | `GUIDELINES.md:186` names WebSockets as unavailable in the HackerRank environment. |
| Inbound email webhook | Removed | `GUIDELINES.md:186`, same line. It needed an external sender to be worth anything and left a route with no screen behind it, which is the "unused routes" finding from the PagerDuty rejection. |
| Cursor pagination | Page numbers (`page`, `pageSize`) with the sort applied in MongoDB | The list shows "Page N of M", which needs a total that a cursor cannot give. At this volume the simpler thing is also the better thing. |
| "Inspired by Zendesk/Freshdesk" | Removed; the product is described in its own words | `GUIDELINES.md:146` forbids external brands and trademarked product content. A real brand name in the README is what got the PagerDuty submission marked down. |

### A bug I introduced and caught before pushing

Replacing the composer with the "this ticket is closed" notice left the composer's auto-grow effect
reading `.style` on a ref that was now `null`, so **every closed ticket rendered a blank page**. The
element-rect check found it (205 elements on every other ticket, 2 on that one) and the browser
console named the line. Fixed by guarding the ref and hiding "Jump to reply" when there is no
composer. It is the reason the layout check runs over real pages and not only over the happy path.

### What I found, not the agent (2026-10-03)

I reported a large white block next to the dark option list when opening a `<select>`, and asked for
it to be confirmed in a real browser window first. It did **not** reproduce: in a real window at 375,
768 and 1280 in both themes, the popup measured exactly its list (140x146 for six options, 140x122
for five) in all twelve combinations. The white block is the DevTools device-mode popup-sizing quirk.
`color-scheme` is already declared per theme (`styles.css:4` and `:64`) and the selects already carry
explicit background and color tokens, so **nothing was changed**, which is what I asked for if it
turned out to be device mode.

### Decision on rule 6, at approval (2026-10-03T07:30:53+00:00)

The agent flagged one judgment call: it had made a customer's reply on a **pending** ticket restart
the SLA and clear an existing breach flag, reading "the same reopen rules" literally.

| Option | What it means |
|---|---|
| Keep it | A revived pending ticket gets a fresh SLA window and its breach flag cleared. |
| **Change it (my choice)** | A revived pending ticket keeps its clock and its breach flag. Only an explicit reopen of a resolved or closed ticket starts a fresh SLA period. |

**My reason:** the breach already happened before the ticket went to pending, and rule 7 says a
breach is permanent. A customer replying should not be able to erase it.

**What changed:** a customer reply on a pending ticket moves it to in progress and nothing else: no
SLA restart, no cleared breach, and the history records it as a status change rather than a
`reopened` entry, because it is not a reopen. A customer reply on a **resolved** ticket is unchanged:
it is a reopen, with a fresh SLA period and a `reopened` entry. The test, the README rules table and
this record were updated together.

## [2026-10-03T11:30:05+00:00] Task: `fix/flaky-sla-checker-test` merged, 3 full runs on main, and `feat/hash-routing`

**HackerRank feedback (recorded as the user gave it, 3 Oct 2026):** Darshan (HackerRank) replied on Discord to my message listing the revisions from my approved proposal: *"It will be good to add these details in the readme before you submit, also add a video walkthrough of the app."* He did not object to the revisions. The README section "Changes from the approved proposal" covers the first request. I will record the video walkthrough at the end, before submitting.

**Approved and merged:** `fix/flaky-sla-checker-test` (--no-ff, main `ab622c6`); branch deleted locally and on origin.
- The flaky test: four schedule tests slept a fixed time and asserted how many timer ticks had landed. Under CPU load the event loop coalesces ticks, so fewer arrived. The fix waits for the condition instead of the clock (reproduced 5 failures in 10 loaded runs before the fix).
- **Full suite 3 times on main:** 174 pass, 0 fail, 604 checks each time (15.0 s, 12.3 s, 11.3 s), and the frontend build passes.

**Process notes:**
- MongoDB was down for part of this task because Docker Desktop's WSL integration was off. I asked, and the user started it. Nothing was merged or tested while it was down.
- The hash-routing work had been started in an earlier session that was never logged (its first prompt is the Darshan message above). It was left uncommitted on a branch cut from the flaky-test branch. I stashed it, merged the approved branch, recreated `feat/hash-routing` from the updated main, restored the work, reviewed all of it, and finished it. A catch-up entry for that earlier session is in the log.

**`feat/hash-routing` (approved earlier; no new dependency; native `hashchange`):**
- Every page and ticket has its own URL: #/dashboard, #/tickets, #/tickets/<id>, #/agents, #/canned-responses, #/activity, #/analytics, #/settings, #/profile.
- The list's search, status, priority, sort and page are in the URL query, so a refresh keeps them. Typing in the search box replaces the history entry, so Back doesn't step through keystrokes; filters and paging add an entry.
- Refresh keeps the page. Back and Forward work inside the app. Sidebar items, ticket titles and the dashboard list are real links, so they open in a new tab.
- A role can't open a page → "You don't have access" (also for another customer's ticket, or one not assigned to the agent). An unknown URL, a missing ticket or a malformed id → "Not found". Both pages link home, and the tab title doesn't reveal a ticket the user may not see.
- Signed out, or with an expired session, any URL goes to sign-in and returns to that URL afterwards. A `next` that points outside the app is ignored.
- Every route change closes the drawer and the new-ticket form and starts at the top. Stale list and ticket responses are dropped when Back/Forward fire quickly.

**Decisions and bugs found:**
| Item | Choice | Reason |
|---|---|---|
| Where the routing tests live | Plain-function unit tests in `frontend/tests` run by `bun test`; the root `test` script runs backend then frontend | No new package, and the routing rules are pure functions |
| `page=1e3` | Digits only; anything else falls back to page 1 | A unit test showed `Number("1e3")` made it page 1000; unknown values should fall back |
| Browser checks | Temporary scripts outside the repo (Chromium over the DevTools protocol, no package) | The Playwright dependency was removed on purpose |

My own test-harness bugs (not app bugs), fixed: the first runs loaded the app, then set the token, then navigated, so the app booted signed out and rewrote the URL. Real deep links are one fresh load, so the harness now sets the session before the page's scripts run.

**Definition of Done:**
- ✅ UI: reachable from the sidebar, dashboard, ticket list, activity page and notifications; works for every role; refused roles get a clear page.
- ✅ API: unchanged; the 403, 404 and 400 responses are now shown as pages.
- ✅ Data: nothing new is stored; the URL is the state. A refresh restores it (checked).
- ✅ States: loading skeletons kept; "couldn't load" has a Retry; not-found and no-access pages added.
- ✅ Responsive and themes: layout checked at 1280, 1024, 900, 768, 600 and 375; new pages screenshotted in dark and light at 1280 and 375.
- ✅ Old data: opened every seeded ticket route as admin, agent and customer.
- ✅ Tests: 21 routing unit tests plus 174 API tests.
- ✅ No half-work: nothing left unfinished.

**Results:** API 174/174; routing unit tests 21/21; build OK; dependency sections identical to the reference.
- Browser routing check: 93/93 (every URL as each role, refresh, filters/sort/page in the URL, Back/Forward, new-tab links, sign-in return, expired session, sign-out, drawer closing and scroll reset at 375, 768 and 900), 0 console errors.
- Layout rect check: 304 states (every page, role and width; the open drawer; dialogs; the notification panel; the no-access and not-found pages), 33,970 elements, 0 outside the screen, 0 sideways scrollers, 0 console errors.

## [2026-10-03T11:32:48+00:00] `feat/hash-routing` approved and merged

Approved by the user. Merged with --no-ff (main `d0d79bc`), pushed, and the branch deleted locally and on origin. On main: API 174/174, routing unit tests 21/21, build OK. Dependency sections still identical to the reference. The video walkthrough Darshan asked for is still to be recorded before submitting.
## [2026-10-03T12:18:42+00:00] Task: `fix/ui-followups` (three bugs I found in manual testing, plus one the fix caused)

**Bugs I found myself while testing the merged app:**
1. The desktop sidebar's collapsed/expanded choice survived sign-out and sign-in. I wanted it kept as a per-browser preference while signed in, but reset to expanded on sign-out, so the next person on a shared computer starts with the full sidebar. Phones already close the drawer correctly.
2. Ticket titles in the list and dashboard (real links since hash routing) showed the browser's default link look. I asked for normal title styling (theme text color), underline or accent only on hover, a visible keyboard focus ring, and the same for every in-app link.
3. On the ticket page the right column was sticky but taller than the screen, so Status history slid under Properties and was cut off. I asked that nothing overlap or become unreachable, checked at 1280, 1024 and 1920 with a long history.
4. While the fix was being checked I found a fourth, caused by the fix itself: the "Go to dashboard" button on the Ticket not found page had no visible text (I sent a screenshot).

**Decisions:**
| Item | Options | Choice | Reason |
|---|---|---|---|
| Sidebar reset | clear on sign-out only / whenever nobody is signed in | Whenever nobody is signed in (sign-out, expired session, no valid session on load) | One rule covers every way a session ends |
| Tall right column | scroll normally when taller than the screen (pinned only when it fits) / move Status history into the main column | Both cards in one column, pinned only while the whole column fits; taller → scrolls with the page | Keeps the properties handy when they fit, never hides anything, no second scroll area |
| Hover underline on titles | keep / drop | Kept as I asked; I will drop it if I find it redundant with the row highlight (asked after seeing the screenshot) | I had asked for accent + underline on hover |

**What changed:** the sidebar resets when nobody is signed in. Links have explicit rest, hover, visited and focus styles. The ticket page's right column is one wrapper, measured with a small hook (a ResizeObserver) so it is pinned only when it fits.

**Bugs found while testing, and how they were caught:**
- *The overlap bug reproduced first.* A check on the old code (26-entry history) showed Properties overlapping Status history at 1280, 1024 and 1920, and hiding 22–23 of the 26 entries at 1280 and 1024. The same check passes after the fix at all three sizes, and a short history is still pinned.
- *The invisible button was a regression I caused.* I had added a default `a:visited` color for the accent. It is more specific than the primary button's white text, so a link you have already visited got accent text on an accent button. `getComputedStyle` hides visited colors on purpose, so my style checks passed. I added a pixel check on real visited links, made by clicking them with real mouse events (Chrome only styles a link as visited after a real click). On the broken CSS it shows 0 visible text pixels in all six cases (dark and light, three pages), matching the screenshot; after the fix (`a:where(:visited)`, zero specificity) all six show the text.
- My test scripts failed at first for their own reasons (a signed-out token reused after sign-out; the mouse aimed at the blank middle of a two-line title). Fixed in the scripts, not the app.

**Definition of Done:**
- ✅ UI: applies to every role; nothing new to hide.
- ✅ API: unchanged.
- ✅ Data: the preference is stored per browser while signed in and cleared when nobody is; verified across refresh, sign-out, an expired session and a second user.
- ✅ States: unchanged; the ticket page's loading, error and not-found states still work.
- ✅ Responsive and themes: layout rect check across every page, role and width; link checks in dark and light; screenshots reviewed.
- ✅ Old data: the ticket check used seeded tickets, one given a 26-entry history.
- ✅ Tests: the existing 174 API and 21 routing unit tests pass. The new behavior is checked in the browser by scripts outside the repo, since this project has no browser test dependency.
- ✅ No half-work.

**Results:** API 174/174; routing unit tests 21/21; build OK; Prettier OK; dependency sections still identical to the reference.
- Browser: sidebar 8/8, links 20/20 (both themes), ticket page 11/11 (3 sizes × long and short history), visited buttons 6/6, routing 93/93, layout rect check 304 states and 33,976 elements with 0 outside the screen.

## [2026-10-03T12:21:24+00:00] `fix/ui-followups` approved and merged

Approved by the user, who also decided to **keep the hover underline** on ticket titles and links (the accent color plus underline on hover and keyboard focus). It is the design I asked for, not a default, and the row highlight does not replace it. Merged with --no-ff, pushed, and the branch deleted locally and on origin. This note is the branch's last commit, so main needs no docs-only follow-up branch. Test results on main are in the log entry for this turn.

## [2026-10-03T13:10:33+00:00] `feat/agent-teams`: the second kind of access rule

**Why this branch.** The independent review's rules 9-12, plus the Settings category guard. The
PagerDuty rejection said "every account sees and changes every incident; add a second kind of access
rule". Role alone is one dimension; an agent's **team** is the second. Everything is service-layer
work plus small UI changes, with the rules in pure modules (`ticket-teams.js`, `ticket-notes.js`,
next to the existing `ticket-lifecycle.js`), the DB only in repositories and the controllers thin.

**Decisions, with the options I weighed and why I chose as I did:**

| Decision | Options | Chosen | Reason |
|---|---|---|---|
| An agent with no categories | (a) covers everything, (b) covers nothing | **(b) covers nothing** | (a) silently defeats the rule for exactly the accounts nobody has set up yet. (b) is a visible, fixable state: the Agents page flags it, the admin sets it in one click, and the API says so with the category named. It is also what every pre-existing agent looks like, so it is the old-data path and is tested as one. |
| Where the queue lives | (a) a second page, (b) a view of the ticket list with its own URL | **(b)** | The rows, filters, sort and pagination are the same list with a different scope. A URL (`#/tickets?view=unassigned`) gives a refresh, Back and a shared link for free, which is what the brief asked for. |
| Claiming | (a) a new `POST /tickets/:id/claim`, (b) the existing assign endpoint with your own id | **(b)** | One rule, one code path, no extra route to keep reachable. The service sees that the target is the actor and records it as `claimed` rather than `assigned`, and sends no notification, because the agent who did it is looking at the ticket. |
| An agent who cannot see an unowned ticket | (a) a flat "no access", (b) name the category | **(b)** | They are support staff looking at the shared backlog, not an outsider. Knowing it is a Billing ticket is what tells them whether to ask for the category or leave it. Same 403, nothing extra permitted. |
| Refiling a ticket | (a) allow it, (b) auto-unassign, (c) refuse | **(c) refuse (409 `ASSIGNEE_OUTSIDE_TEAM`)** | (a) makes the team rule true at assignment and false a moment later. (b) quietly takes a ticket off somebody. (c) makes the admin reassign first, which is the decision they were going to have to make anyway. |
| Editing a public reply | (a) allow within the window, (b) never | **(b)** | A customer has already read it. Correcting a note the team wrote to itself is housekeeping; changing an answer under the person who received it is not. |
| Which fields a requester may edit | (a) title and description, (b) also category | **(a)** | Where a ticket is filed decides who works it, so it is the team's call. The requester fixes what they wrote. |
| Removing a category used by finished tickets | (a) block, (b) allow | **(b)** | Closed work is history. Blocking on it would make a category unremovable forever. Agents and open tickets block. |

**Bugs I found by testing, not by reading:**
- *The lock message named the wrong cause.* A staff reply is also what moves an open ticket into
  progress, so checking the status first reported "work has already started" when the real reason was
  "our team has already replied". My own API test had passed because it only asserted the words
  "already" and "reply", which both messages contain. Found by driving the real UI and reading the
  sentence on screen. Fixed the order, and tightened the test to assert the sentence.
- *A button inside a table row also opened the row.* The row-click handler ignored links but not
  buttons, so clicking Claim would have opened the ticket as well. Pre-existing; the queue is the
  first table with a button in a row, which is what surfaced it.
- *My own check scripts were wrong twice* before the app was: a wait matched the loading skeleton's
  rows rather than real ones, and `localStorage` was read on `about:blank`. Fixed in the scripts.

**Tested on old data.** The dev database still held the seed from before teams existed. Against it:
agents with no categories got an empty queue and a 403 `OUTSIDE_TEAM` naming the category; a new
ticket went to the unassigned queue with every admin notified; a customer editing an old resolved
ticket got 409 `TICKET_LOCKED`; the category usage counts and the deletion refusal were correct. The
API suite also proves the rules on a ticket seeded 48 hours ago and on an agent whose categories are
cleared.

**Results:** API 222/222 (was 174, 48 new); routing unit tests 25/25; build OK; Prettier OK; element
rect check over 3 roles x 7 pages x 1280/375 x dark/light: every page `scrollWidth === viewport`,
zero elements off screen, zero console errors. No new dependencies.

## [2026-10-03T13:13:38+00:00] `feat/agent-teams` approved and merged

Approved as built. The five UI observations made while reviewing (page spacing, the SLA hours input
clipping three digits, the Analytics filter row alignment, and the SLA-breached tile reading as too
alarming) were deliberately kept out of this branch and queued. The user set the order: **next is
`feat/bulk-actions`**, then `fix/ui-polish`, in which the SLA hours input and the Analytics filter
row must be fixed, while the page spacing and the SLA-breached tile are only to be touched as small
safe changes. Merged with --no-ff, pushed, and the branch deleted locally and on origin. Test results
on main are in the log entry for this turn.

## [2026-10-04T07:40:54+00:00] `feat/bulk-actions`: rules 13-15, records that change together

**Why this branch.** The rejections asked for six or more screens that change several records or move
something through a status, and for rules that hold across them. This branch adds three: bulk actions
on the ticket list, deactivating an agent with their work handed on, and ticket merge. Rules sit in pure
modules (`ticket-bulk.js`, `ticket-reassign.js`, `ticket-merge.js`), the DB in repositories, the
controllers thin. The work started in an earlier session that I stopped part-way; this session picked it
up and extended it to the fuller brief (bulk priority, the explicit queue override, and merge).

**Decisions, with the options and why:**

| Decision | Options | Chosen | Reason |
|---|---|---|---|
| Atomicity | (a) a MongoDB transaction, (b) validate everything, then apply | **(b)** | Checked, not assumed: the dev MongoDB is a standalone node and refuses transactions. A replica set would change `setup.sh`, whose flow must match the reference. The README says so. A ticket changed by someone else in the gap is re-checked by the single action as it is written. |
| Where bulk rules come from | (a) a bulk-specific rule set, (b) the single action's own checks | **(b)** | One set of rules cannot drift. The assignment checks were pulled into one function the single and bulk paths both call. |
| A ticket already in the target state | (a) reject it, (b) count it as unchanged | **(b)** | Re-sending a status to one ticket is accepted and changes nothing; rejecting it in bulk would refuse a whole selection over a no-op. |
| A missing ticket id in a bulk request | (a) 404 the request, (b) report it with the others | **(b)** | One stale row should not hide the reasons for the rest. |
| One picker or three buttons for bulk | (a) separate controls per action, (b) one grouped picker | **(b)** | Stays one row on a 375 px phone; the confirmation names the action and the count. |
| The last cover for a category | (a) always refuse, (b) refuse unless the admin explicitly chooses the queue | **(b)**, as briefed | The default protects the work; the explicit choice covers a real need (someone leaving) without a workaround. The dialog states the consequence before the button. |
| What happens to the duplicate's opening message on merge | (a) drop it, (b) carry it over as a reply | **(b)** | It is what the customer wrote. It moves as a reply from them, dated when it was sent, so the thread still reads in time order. |
| Reopening a merged duplicate | (a) allowed in the 14-day window, (b) refused | **(b) 409 `TICKET_MERGED`** | Its replies now live on the primary; a reopened, empty duplicate would split the conversation again. |

**Bugs and surprises found while building:**
- *The notification would have failed silently.* The merge's "your tickets were merged" notification
  used a new type the notification model's enum did not allow. Caught by reading the model before the
  first test run.
- *A flaky test, mitigated rather than explained.* One audit-count assertion failed in 2 of the early
  full-suite runs and never again in 14 later runs. It counted entries in a time window; it now matches
  on the data (an "assigned" entry naming the new agent), which no timing can affect. I could not
  reproduce the original failure to find its root cause, and I say so here rather than claim a fix.
- *My own test bugs:* a default parameter turned a "no token" call into an admin call, and the seed
  happens to give every seeded Billing ticket to Lena, so a test assigning them to Lena changed nothing.
  Both fixed in the tests.

**Tested on old data:** bulk status, assign and priority on tickets seeded hours to days ago (a breach
stays on the record), deactivation handing on Diego's seeded tickets without touching their clocks, the
pre-teams-shaped agent whose uncovered ticket goes to the queue, and a merge of the seeded duplicate a
day older than its primary, which keeps its clock, status, priority and assignee.

**Results:** API 267/267, run twice back to back; routing unit tests 25/25; build OK; Prettier clean;
no dependency change. Browser, driven through the real app: bulk refusal panel (17 of 20 refused,
nothing changed, deselect worked), bulk priority, both deactivation dialogs, and a merge end to end.
Element-rect check at 1280 and 375 in both themes over every page and role, plus the selection bar,
the refusal panel, the last-cover dialog and the merge modal: every state scrollWidth equal to the
viewport, with no element off screen. The only console entries were Chrome's network log lines for the
four deliberate 422 refusals.

## [2026-10-04T07:47:05+00:00] `feat/bulk-actions` approved and merged

Approved by the user as built. Merged with --no-ff, pushed, and the branch deleted locally and on
origin. This note is the branch's last commit, so main needs no docs-only follow-up branch. Per the
new standing rule, work stops here until the user's next prompt; `fix/ui-polish` is next in the order
they set (SLA hours input and Analytics filter row must be fixed; page spacing and the SLA-breached tile
only as small safe changes). Test results on main are in the log entry for this turn.

## [2026-10-04T09:39:47+00:00] `fix/ui-polish`: ten polish items, two added mid-task, and what checking them uncovered

**Why this branch.** The user's queued UI notes (page spacing, the SLA hours input, the Analytics
filter row, the SLA-breached tile), keyboard-only checkbox focus, no hover underline in lists, an
honest sign-in answer for a deactivated account, an honest README rule count, read-only file parity,
and the submission-gate skill. Mid-task the user added item 11 (select-all in the table header),
replaced item 12 twice (the dashboard tiles, finally "the same tiles as Analytics"), clarified item 1
(the gutters with the sidebar collapsed), and reported the missing SLA compliance tile.

**Decisions, with the options and why:**

| Decision | Options | Chosen | Reason |
|---|---|---|---|
| Item 1: gutters with the sidebar collapsed | (a) drop the 1100 px cap, (b) widen the cap by exactly the width the sidebar gives up | **(b)** | The user asked for the same gutters as with the sidebar open. Measured: 20/50/290 px both ways at 1280/1440/1920. |
| Item 2: SLA input width | (a) a bigger fixed width, (b) sized from the font (3ch + padding + spin buttons) | **(b)** | It follows the font; 720 (the maximum) fits at every width. |
| Item 3: Analytics filters | (a) bottom-align controls with labels above, (b) labels beside the inputs, one centre line | **(b)** | Everything at the 38 px control height on one line; phones get one date per row. |
| Item 5: checkbox focus | (a) per-component rules, (b) one global checkbox rule | **(b)** | Every checkbox behaves the same; the stacked category picker was fixed on the way. |
| The SLA compliance tile | (a) load Analytics on the dashboard, (b) compute it in `/tickets/stats` | **(b)** | Root cause: the tile borrowed the Analytics page's data, which loads only when an admin opens Analytics, so it was missing on a fresh load and showed the Analytics date range. (b) is always there, all time, for every role; the formula is shared (`ticket-sla.js`). |
| Item 12: the tiles | (a) restyle the dashboard markup, (b) one `StatTile` component for both pages | **(b)** | The user asked for the Analytics tiles exactly; one component cannot drift. |
| Item 7: unknown email | (a) skip bcrypt when no account matches, (b) compare against a dummy hash | **(b)** | Equal work in every case, so timing cannot reveal which emails exist; 403 is said only with the right password. |
| Item 8: what counts as a rule | (a) every error case, (b) each distinct rule, cases under it | **(b)**, as asked | 36 rules, 106 cases, each with its test; all 132 quoted test names checked. |
| Item 11: the table at 768 px | (a) trim padding, (b) cards by available width (container query) | **(b)** | Measured: the ticket table needs ~820 px and scrolled sideways at 721-1140 px with the sidebar open, not only at 768. Trimming could not cover 1000-1023 px (678 px available). Modals are native dialogs (top layer), so panel containment cannot affect them. |

**Bugs and surprises found by checking rather than reading:**
- The README already claimed a 403 for a deactivated sign-in; the code returned 401. Fixed with item 7.
- The ticket table scrolled sideways between 721 and 1140 px; earlier layout checks ran only at 1280 and 375.
- The "Select all" label and the Agents category boxes stacked under their checkboxes (the global
  label rule is a column).
- My own snags: a test script's bell selector missed (18 states rerun, all clean); my curl loop hit the
  login rate limit (the limit doing its job); a shot taken before paint showed no focus ring.

**Item 9:** both read-only files were already byte-identical (restored in f670765); no commit.

**Results:** API 273/273 and unit 25/25, three runs in a row; build OK; Prettier clean on changed files;
dependencies identical to the reference. Element-rect check: 198 page/state x size x theme
combinations (1280, 768, 375; both themes; every page and role, dialogs, drawer, notification panel),
0 off screen, 0 console errors. Fresh clone: exact install and start, build, 273 + 25 tests, clean
tree. skills/validate: 0 FAIL, 0 MANUAL, 4 warnings (report in `../validation-report-fix-ui-polish.md`).

## [2026-10-04T09:43:34+00:00] `fix/ui-polish` approved and merged

Approved by the user as built. Merged with --no-ff, pushed, and the branch deleted locally and on
origin. This note is the branch's last commit, so main needs no docs-only follow-up branch. Per the
standing rule, work stops here until the user's next prompt. Test results on main are in the log entry
for this turn.

## [2026-10-04] `fix/reply-limit`: a capped conversation, reply paging, an assignee filter, and notifications that are read by being opened

**The problem I was given:** replies are embedded in the ticket document with no limit, so a long
ticket could pass MongoDB's 16 MB document limit and the next reply would fail with a 500. Three
further items arrived during the branch: an "Assigned to" filter on the ticket list, and the
notification panel's read behavior.

**Decisions, with the options and why:**

| Decision | Options | Chosen | Reason |
|---|---|---|---|
| Enforcing the 500-reply cap | (a) count the replies, then push, (b) one atomic push that matches only while the array is under 500 | **(b)**, as asked | This MongoDB is a single node, so there is no transaction to wrap (a) in; `replies.499: {$exists: false}` in the filter makes the database itself the gate. Proven by two simultaneous replies at 499 leaving exactly 500. |
| How the reply is written | (a) push onto the loaded document and `save()`, (b) atomic `$push`, then `save()` for the status only | **(b)** | (a) would write a stale `replies` array back over the atomic push. The document's own `replies` is never touched, so `save()` sends only the status and the clock. |
| Where the status decision happens | (a) after the reply is stored, (b) before the push | **(b)** | A reply the ticket has no room for must leave the status and the SLA clock exactly as they were; verified by a test. |
| The reply the resolve rule looks for | (a) read the windowed replies, (b) carry a count of public staff replies on the ticket | **(b)** | With only the latest 50 replies on the page, an answer older than that would have looked absent and "Send a public reply before resolving" would have come back on an answered ticket. A test puts the only staff reply 80 replies back. |
| Counts sent to the page | (a) one count, (b) `replyCount` (what the rule counts) plus `visibleReplyCount` (what this viewer may read) | **(b)** | Internal notes are hidden from customers, so one count would make either the "N of 500" notice or the "(N more)" button lie to them. |
| Keeping the thread whole | (a) render the window plus the loaded pages, (b) keep every reply shown and fold each new window in | **(b)** | Sending a reply moves the latest page on by one, and (a) silently dropped the message that fell off its start. The page in hand stays authoritative for its own stretch, so a deleted note still disappears. Checked in the browser: 101 rows -> 102 after a reply, nothing lost. |
| Merging into a long ticket | (a) leave merge alone, (b) refuse a merge that would carry the primary past 500 | **(b)** | A cap enforced on one path only is not a rule. The merge picker already hides what `mergeBlock` refuses, so the UI follows automatically. |
| The follow-up button | (a) show it to everyone, (b) only to the requester, with the reason for staff | **(b)** | Only customers raise tickets, so for staff (a) is a button the API would refuse. |
| "Unassigned" in the new filter | (a) `assignedTo: null` on the viewer's own list, (b) the Unassigned queue's own scope | **(b)** | (a) would have shown an agent unowned tickets in finished statuses that `assertCanView` refuses them, i.e. rows they cannot open. (b) can never show more than the queue does. |
| An agent filtering by another agent | (a) refuse it, (b) match nothing | **(b)** | The filter writes over the scope that limits an agent's list to their own tickets; matching nothing keeps the rule while leaving the control uniform. **Uncertain:** the option is in the list because the brief asked for it, but for an agent a teammate's name can only ever show an empty list. |
| The `assignedTo` query parameter it replaces | (a) keep both, (b) replace it with `assignee` | **(b)** | `assignedTo` had no UI consumer at all (a dead parameter the validator looks for), and the new one also takes "unassigned". |
| Reading notifications | (a) keep marking all read on open, (b) read one by opening it, plus an explicit "Mark all as read" | **(b)**, as asked | The badge is meant to count what has not been dealt with; one glance at the panel used to erase that. |
| What the mark endpoints answer with | (a) `{ success: true }` and a refetch, (b) the list as it then stands | **(b)** | The badge and the rows settle in one request instead of waiting for the 15-second poll. |
| Another user's notification | (a) 403, (b) 404 | **(b)** | A 403 would confirm that somebody else's notification exists. The query is scoped to the owner, so it simply matches nothing. |

**Bugs and surprises found by checking rather than reading:**
- My own bug, caught by a test: `presentTicketDetail` deleted the raw counts from the ticket object
  *before* the lifecycle rules read them, so a ticket whose answer was pages back reported
  "Send a public reply to the customer before resolving this ticket." Fixed by destructuring instead
  of mutating; the test ("resolving still needs a staff reply... even when it is pages back") was
  written first and failed on the broken code.
- `GET /tickets` still loads every reply of every row (the list does not use them). Left alone as
  outside this branch, and reported.
- The seeded tickets used for the limit tests are filed under "general", which agent1 does not cover,
  so the first run of the new tests failed with 403s until the staff replies came from an admin. The
  team rule doing its job.
- An agent's `assignee=unassigned` test originally compared two lists that could both have been
  empty; strengthened to assert the queue is not empty first.

**Checks:** API 303/303 and unit 36/36, three runs in a row; build OK; Prettier clean on changed
files; dependency sections of all three manifests identical to the reference. Element-rect checks
(throwaway CDP scripts outside the repo, no package): ticket detail with 120/460/500 replies, 75
page/state x size x theme combinations (1280/768/375, both themes, three roles: first page, after
"Show earlier replies", the 450+ notice, the full state, the follow-up form) - 0 off screen, 0 console
errors, scroll drift 0 px; the ticket list and its new filter, 54 combinations - 0 offenders, the
select matching the priority control exactly (38 px, 14 px, 8 px radius, same centre line); the open
notification panel, 58 combinations - 0 offenders, badge unchanged by opening and reopening, one row
read on click, the lot read from the header. Fresh clone of the branch: exact install, build,
303 + 36 tests, `bun start` on 3000/8000, health with MongoDB connected, the seeded 24 tickets, every
feature endpoint, persistence, the error paths (400/404/403), restart reset, clean tree.

**Dev database:** the three long conversations and the notification fixtures were only ever in
`support_desk_db` for the browser checks, never in the seed or the repo, and were removed afterwards
along with the audit entries and notifications they left. The fresh-clone run used its own database
(`support_desk_fresh`, dropped afterwards) and the dev app was restarted without reseeding, so the
ticket the user raised by hand ("im not able to login") is still there.

## [2026-10-04] `fix/reply-limit`: two follow-up fixes before approval

**What the user asked:** (1) the "Assigned to" filter should offer agents only "Anyone", "Unassigned"
and "Me", with admins keeping the full list; (2) the ticket list should leave the replies out of its
query and return `replyCount` instead, with proof that no list, dashboard or bulk screen used them.

| Decision | Options | Chosen | Reason |
|---|---|---|---|
| Where the option sets live | (a) inline in `TicketList.jsx`, (b) one pure `assigneeChoices(role, agents, userId)` | **(b)** | The component is not unit-testable without a browser; the pure function is, and both role sets are now pinned by tests. |
| An agent's URL naming another agent | (a) drop it, (b) keep it, show "Another agent", match nothing | **(b)** | The API already answers it safely (nothing, never that agent's tickets). Dropping it would need the user id in the URL parser; the select stays honest about what it is set to. |
| `replyCount` for a customer | (a) all replies, (b) public replies only | **(b)** | A count that includes internal notes tells a customer how many exist. Same reason `visibleReplyCount` exists on the detail. |
| Where the counts are computed | (a) before sorting, (b) after the page is cut | **(b)** | Only the rows on screen are measured. |
| Proof nothing used the replies | (a) trust the grep, (b) grep, then test the shapes, then drive every list screen | **all three** | `grep` found no reader outside the detail page; the new tests fail on the old code (4 of 4, checked by stashing the source) and pass on the new; the browser check covered Tickets, the queue, a sort, the bulk bar and the dashboard. |

**Checks:** API 307/307 and unit 38/38, three runs in a row; build OK; Prettier clean. Element-rect
check, 34 states (Tickets at 1280 and 375, both themes, three roles, plus the unassigned queue with a
sort, the admin bulk bar with the whole page selected, and the dashboard): 0 off screen, 0 console
errors. Agents' select shows `["Anyone","Unassigned","Me"]`, admins' shows every agent A-Z, customers
have none.

## [2026-10-04] `fix/reply-limit` approved and merged

Approved by the user as built, after the two follow-up fixes. Merged with --no-ff, pushed, and the
branch deleted locally and on origin. This note is the branch's last commit, so main needs no
docs-only follow-up branch. Per the standing rule, work stops here until the user's next prompt. Test
results on main are in the log entry for this turn.
