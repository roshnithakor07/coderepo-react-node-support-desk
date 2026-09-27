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
