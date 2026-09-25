# Sarang code standards (read before changing code)

Goal: a new person can find any behaviour in minutes and change it without breaking money.

## Where things live
- `src/main/services/*.service.ts`: business logic, one service per area. No UI knowledge.
- `src/main/ipc/handlers/*.handler.ts`: thin. Validate input (zod in `src/main/validation`), check permission, call a service, return. No business logic here.
- `src/shared`: code used by both sides (money, GST presentation, tax presets). Pure functions only, no I/O.
- `src/renderer/src/modules/<area>/ui`: screens. Shared parts in `src/renderer/src/shared`.
- `prisma/`: schema and migrations. Never edit an applied migration; add a new one.

## Money and tax (hard rules)
- All arithmetic on amounts goes through `@money` (`src/shared/utils/money.ts`). No `amount * rate` in a service or screen.
- Tax presentation goes through `@gst`; country data through `@taxpresets`.
- The UI, backend, print and reports must call the same function for the same number. A number computed in two places is a bug.
- Every new money feature ships with a property or table test in `__tests__`.

## Structure
- One responsibility per file. Aim for files under 400 lines; split before crossing 600. Long files touched by a task get split by responsibility, not by size only.
- Functions do one thing, named for what they do (`splitTaxHalves`, not `calc2`). Avoid boolean flag parameters; use two functions or an options object.
- No global mutable state except through the session object (after step U1). Do not add new module-level `let` state.
- Errors: services throw typed errors with a user-safe message; handlers convert them; screens show the translated message.

## Naming and text
- Screen text always through i18n keys; no hard-coded English in `.tsx` except English-locked vertical screens.
- Use one word per concept across the app (see master file section 11, naming). Do not introduce a synonym.
- Comments: only where the reason is not obvious from the code. No decorative comment blocks.

## Tests and checks
- Before a task is done: `tsc` for node and web, full vitest, and the task's own tests.
- Tests live next to the code in `__tests__`. Test names state the rule being proved.
- Do not rewrite shared JSON locale files with parse/stringify; splice single keys.

## Commits
- One task, one commit, message says what and why. Branch `release-1.6-work` until the founder approves merging to `main`.
