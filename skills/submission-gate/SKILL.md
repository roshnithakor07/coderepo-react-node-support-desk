---
name: submission-gate
description: Strict pre-submission gate for this HackerRank Code Repo app. Run it last, in a fresh session, before every submission. It checks every written HackerRank requirement plus the specific reasons earlier submissions were rejected, and blocks submission while any check fails.
---

# Submission Gate

A strict, read-only final check before submitting to HackerRank. It exists because two earlier submissions were rejected for requirements that were already written down: an added dependency, a removed starter package, layout overflow on narrow screens, too few server-side product rules, a single kind of access rule, business logic in request handlers, an action that misbehaved on old records, a missing confirmation, real brand names, and unused routes.

**Verdict rule:** the gate passes only when every check below is ✅ with evidence. One ❌ means **do not submit**. "Probably fine", "not checked" and "assumed" count as ❌.

## How to run

- Run in a **fresh session** that did not write the code, so the gate is not grading its own work.
- **Read-only.** Never edit tracked files, commit, push, or change branches. Scratch files and the report go **outside** the repo (for example `../submission-gate-report.md`).
- Work from a **fresh clone** of `origin/main` in a temp folder, not the working copy.
- Read first, fully: `GUIDELINES.md`, `AGENTS.md`, `README.md`, `skills/validate/SKILL.md` and its references, and (when present next to the repo) `../project_fullstack_node_app.md` and `../support-desk-rules.md`.
- Every check records **evidence**: a command and its output, a file:line, a test name, or a measured value.
- Log this run per AGENTS.md.

## A. Dependencies and stack (rejection #1)

1. For the root, `frontend` and `backend` `package.json`, diff `dependencies` and `devDependencies` against the reference repo (`ProblemSetters/coderepo-react-node-calendar`). **Must be identical: zero added, zero removed, no version older.**
2. `bun.lock` contains no package the reference does not have.
3. No HTTP client, component library, ESLint/Husky/lint-staged, reload package, WebSocket library, test framework package, or CDN/Google font link anywhere in the source or `index.html`.
4. Fonts and media are bundled locally (`@fontsource/roboto` from the starter).
5. Stack unchanged: React + Vite, Express, MongoDB/Mongoose, Bun workspaces, JavaScript (no TypeScript).

## B. Read-only paths and structure

6. Every file under `readonly_paths` in `hackerrank.yml` that also exists in the reference is byte-identical to it (`cmp`); list any difference with the reason.
7. `.prettierrc`, `.prettierignore` and `.editorconfig` match the reference.
8. The repo layout matches AGENTS.md §6.1 and the reference structure (feature folders; route → controller → service → repository).

## C. Clean checkout (acceptance criteria)

9. In the fresh clone, run the exact `hackerrank.yml` install command, then the start command. Both succeed with **no errors or warnings**. Frontend on 3000, backend on 8000.
10. `bun run build` (frontend) succeeds.
11. `bun run test` passes in full; record the counts. Run it **three times** to catch flaky tests.
12. The working tree is clean afterwards (`git status`).

## D. Layout at every width (rejections #1 and #2)

13. For every page, for every role, at **1280, 1024, 900, 768, 600 and 375 px**, in dark and light theme:
    - `document.documentElement.scrollWidth === window.innerWidth`;
    - **no visible element** has `getBoundingClientRect().right > innerWidth` or `left < 0` (this catches content clipped by `overflow: hidden`, which scrollWidth misses);
    - the main content fills the screen, nothing is cut off or overlapping.
14. Below ~1000 px the sidebar is a menu/drawer; the open drawer is full height, closes on navigation, sign-out and sign-in.
15. At 375 px the dashboard, ticket list and ticket detail are **usable**: every action is reachable and readable.
16. Also check open dialogs, the confirmation dialog, the notification panel and native selects.
17. Use a temporary script **outside the repo** with no added package.

## E. Product rules (rejections #1 and #2)

18. List every **distinct server-side product rule** with file:line, endpoint, error code and the test that proves it. "Not found" checks and plain schema validation do **not** count. **Target ≥ 15.**
19. List every screen that **changes more than one record or moves something through a status**. **Target ≥ 6.**
20. Error codes are correct: 400 malformed input, 401 not signed in, 403 not allowed, 404 not found, 409 state conflict, 422 valid input that breaks a business rule. No route returns 500 for bad input.
21. **Two kinds of access rule** exist: role, **and** a second dimension (ownership / team by category).
22. Every rule is respected in the UI: the action is hidden or disabled **with the reason shown**.
23. The README "Product rules" table matches the code exactly (no rule missing, none claimed that does not exist).

## F. Behavior on old records (rejection #2)

24. Exercise every state-changing action (status moves, reopen, priority change, assign, claim, close, bulk actions, deactivate) on **old seeded records** (created hours or days ago), not only fresh ones. Timers and SLA clocks reset correctly; nothing is breached or notified by mistake.
25. Every action's label says exactly what it does.

## G. Architecture and code quality (rejection #2)

26. No business rules, queries or aggregations in routes or controllers; services hold rules; repositories hold all DB access.
27. Every backend product route has a reachable frontend consumer; every frontend API call has a backend route (GUIDELINES bidirectional coverage). No unused routes.
28. No dead code, debug output (`console.log` outside startup/errors), TODOs, placeholder text, "coming soon" or half-built screens.
29. Prettier passes on the source files.
30. American English everywhere.

## H. UX states and safety

31. Every page has designed loading, empty, error (with retry) and success states; no flash of empty-state text before data loads.
32. Every destructive or hard-to-undo action uses the custom confirmation dialog; no `window.confirm`, `alert` or `prompt`.
33. Refresh keeps the current page and filters; browser Back/Forward stay inside the app; no-access and not-found pages exist.
34. Keyboard focus is visible; dialogs trap focus and close on Esc.

## I. Branding, data and secrets (rejection #2)

35. No real company, product or brand names in the UI, README, seed or tests ("inspired by …" included). Demo emails use reserved domains only (`example.com`, `.test`).
36. No secrets committed; `.env` files ignored; `.env.example` present; secrets only from environment variables.
37. Seed is deterministic, realistic, and `bun start` resets to it.

## J. README and proposal

38. README describes the product, users, stack, structure, setup, seeded logins, commands, tests, product rules table, and "Changes from the approved proposal" with reasons.
39. The README matches the code (no claim that is not true).
40. Video walkthrough link is in the README and opens (unlisted, not committed to the repo).

## K. Verifier and submission

41. Run `skills/validate` exactly as written; **zero FAIL**. List every WARN with a decision.
42. `git archive` size is under 5 MB; `GUIDELINES.md` and `skills/` handling matches `.gitattributes`.
43. The AGENTS.md log file is copied **unedited** into `transcripts/` (byte-compare with the source).
44. Every commit on `main` is authored by the participant only; **zero** `Co-Authored-By`, "Generated with" or other AI attribution in commit messages, code or docs.
45. The repo is **private** (`gh api repos/<owner>/<repo>` → `"private": true`).
46. Custom skills (including this one) are under `skills/`.

## Report

Write `../submission-gate-report.md` (outside the repo):

1. **Verdict:** PASS only if all 46 checks are ✅; otherwise BLOCKED, with the count of ❌.
2. A table: check #, check, result (✅/❌), evidence.
3. For every ❌: what is wrong, where (file:line), and the smallest fix.
4. A short list of anything ambiguous that needs the participant's decision.

Do not fix anything during the gate. Fixes happen on a branch afterwards, and then the gate runs again from the start.
