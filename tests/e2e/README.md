# E2E test suite (Phase 55)

Drives the real Electron app (real SQLite, no mocks) via Playwright's
`_electron` API — the same technique every phase's live UAT has used
ad-hoc since Phase 43, now built as a reusable project asset instead of a
one-off scratch script per phase.

## Run everything

```
npm run test:e2e
```

Starts the dev server itself if one isn't already running on `:5173`, runs
every suite in `suites/` in order, prints a summary, exits non-zero on any
failure.

## Run one suite

```
node tests/e2e/run-all.js 03-billing
```

(matches by filename substring)

## What each suite does automatically

- Resets the `admin` password to a known value for the suite's duration,
  re-randomizes it afterward — no UAT credential is ever left active.
- Closes the Electron app in a `finally` block even if a suite throws.
- Cleans up its own test data via `h.cleanupByNamePrefix('Your Test Prefix')`
  in that same `finally` block.

**Row-level cleanup, not a whole-file DB snapshot/restore.** An earlier
version of this harness backed up `sarang.db` before a suite and overwrote
it back afterward — that turned out to be unsafe (see `harness.js`'s "DB
cleanup" section header comment for the full writeup): `electron-vite dev`
always keeps its own Electron window open in addition to whatever a suite
launches, so there's a second live connection to the same SQLite file for
as long as the dev server is running, and swapping the file underneath it
risks corruption, not just an EBUSY error. Every suite must therefore name
its test data with a distinctive, greppable prefix (e.g. `E2E Commerce
Customer`, `E2E Commerce Widget`) and clean up via
`h.cleanupByNamePrefix(prefix)` — same pattern every phase's manual UAT
cleanup in this project has always used, just centralized into one helper.

**This means `npm run test:e2e` only ever touches rows it created itself**
(matched by prefix) — it does not attempt to restore pre-existing data to
some prior snapshot. It is NOT safe to point at a founder's production data
file; only ever run it against `.dev-data/sarang.db`, and always give test
data an unambiguous name prefix so cleanup can find it.

## Writing a new suite

Copy `suites/00-smoke.js` or `suites/01-core-commerce.js` (the latter shows
the full pattern: create test data via real API calls, drive real UI,
verify via API, clean up by name prefix in `finally`). Use `harness.js`'s
exports — `login`, `gotoHash`, `switchBusinessType`, `topModal`/
`closeTopModal`, `fmtLocalDateTime`, `cleanupByNamePrefix`, `makeResults()`
— rather than re-deriving Electron/Playwright boilerplate. See `harness.js`'s
own header comments for the gotchas it already encodes (HashRouter nav,
splash-window handling, industry-store staleness after raw IPC business-type
changes, the WAL/second-connection gotcha above).

## Known constraints

- Suites run **sequentially, not in parallel** — concurrent suites racing
  the same live app/DB would produce confusing cross-suite failures.
- Every suite must use a distinctive test-data name prefix and clean up via
  `cleanupByNamePrefix` — there is no automatic whole-DB safety net anymore.
