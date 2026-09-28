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
