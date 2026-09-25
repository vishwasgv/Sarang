# Sarang code map (where things live)

`ARCHITECTURE.md` is the original 1.0 design spec. This file is the current map of the code. Rules for writing code are in `CODE-STANDARDS.md`.

## Processes and folders
| Folder | Runs in | Purpose |
|---|---|---|
| `src/main` | Electron main (Node) | database, business logic, IPC handlers, LAN mini-servers |
| `src/preload/index.ts` | preload | the only bridge: exposes a typed `window.api` (deep-frozen) built from `invoke(channel, payload)` |
| `src/renderer/src` | browser window (React) | screens, i18n, state |
| `src/shared` | both | pure functions and data: money, GST presentation, tax presets, audit event names |
| `prisma/` | build/migrate | `schema.prisma`, `migrations/` (never edit an applied one) |
| `tests/e2e` | Playwright | one suite per area, run with `npm run test:e2e` (needs `npm run dev` first) |

Path aliases: main `@main`, `@shared` (= `src/shared`). Renderer `@renderer`, `@modules`, `@app`, `@assets`, `@shared` (= renderer shared UI, not `src/shared`), and `@money`, `@gst`, `@taxpresets` pointing into `src/shared`.

## Request flow (a button click to the database)
1. Screen in `src/renderer/src/modules/<area>/ui` calls `window.api.<group>.<method>(payload)`.
2. `src/preload/index.ts` maps that to `ipcRenderer.invoke('<group>:<method>', payload)`. Types come from `src/main/ipc/channels.ts` (`IpcChannels`, `ApiResponse`).
3. `src/main/ipc/index.ts` registers every `handlers/<area>.handler.ts`. A handler registers channels through `registerHandle()` (`ipc/handle.ts`), which wraps errors into `{ success:false, error:{code,message} }`.
4. The handler validates input (zod in `src/main/validation`), checks permission with `requirePermission(key)` (`ipc/permission-guard.ts`, reads `getCurrentSession()` from `auth.service.ts`), then calls a service.
5. `src/main/services/<area>.service.ts` holds the logic and talks to Prisma through `getPrisma()` (`database/db.ts`). Money and tax maths go through the shared modules below.
6. The result goes back as `ApiResponse`; the screen shows data or the translated error.

To add a feature: schema/migration -> service (+ `__tests__`) -> zod schema -> handler -> `channels.ts` type -> preload entry -> screen -> i18n keys (English first, translated in TL rounds) -> E2E if user-visible.

## Money and tax modules
- `src/shared/utils/money.ts` (`@money`): the only place amounts are added, multiplied, split or rounded. Includes the `invoice_rounding_rule` setting.
- `src/shared/utils/gst-presentation.ts` (`@gst`): CGST+SGST / IGST / GST presentation modes, tax-inclusive (`prices_include_tax`) splitting.
- `src/shared/data/tax-presets.ts` (`@taxpresets`): tax presets for 50 countries and which languages are English-locked.
- Main-side tax services: `tax.service.ts`, `tax-preset.service.ts`, `india-gst-slabs.service.ts`, `tax-category-backfill.service.ts`, `gst-type.util.ts`, `note-tax.util.ts` (credit/debit note tax).
- Documents: `billing.service.ts` (sales), `bill.service.ts` (supplier bills), `credit-note.service.ts`, `debit-note.service.ts`, `purchase-order` and GRN services. Books: `journal-entry.service.ts`, `chart-of-accounts.service.ts`, `financial-statements.service.ts` (Balance Sheet, General Ledger, Day Book, Cash Flow), `report.service.ts`, `customer-ledger.service.ts`, `supplier-ledger.service.ts`.

## Where other areas live
- Auth and sessions: `auth.service.ts` (holds the process-global `currentSession`, replaced in step U1), `security/`.
- Licence: licence services and the Ed25519 public key injected in `electron.vite.config.ts`.
- Notifications and reminders: `notification.service.ts`, `notification-queue.service.ts`, `khata-reminder.service.ts`, `logistics-notification.service.ts`.
- Ask Sarang (AI): `ai-query.service.ts`, `ai-vertical-templates.service.ts`, `ai-aggregations.service.ts`, `ai-*-provider.ts`; opt-in module `ai_assistant`.
- Vertical (business type) features: one service + handler + `renderer/modules/<vertical>` each; templates in `industry-template.service.ts`. Service-vertical screens are deliberately English-only.
- LAN mini-servers (phone/tablet access on the same Wi-Fi): `src/main/server/*-server.ts` (QR ordering, Doctor Pad, Owner View, field orders, kitchen display, token queue).
- Backup/restore: `backup.service.ts`. Import wizard: `import.service.ts`. Exports and printing: `export.service.ts`, `utils/svg-charts.ts`.
- i18n: `src/renderer/src/i18n/locales/<lang>.json` (13 languages; splice single keys, never re-serialise); main-process strings in `src/main/i18n`.
- In-app Manual: `renderer/modules/manual` (guides as markdown per language). Tutorial tour: `renderer/modules/tour`, `renderer/src/shared/tour`.
- Routes: `renderer/src/app/router.tsx` (HashRouter); sidebar module groups in the app shell; global state in `app/store` (Zustand).

## Tests
- Unit: `npx vitest run`, files in `__tests__` next to the code. Typecheck: `npm run typecheck` (web + node).
- Migrations (PowerShell only): `$env:DATABASE_URL = "file:D:/Sarang(business OS LITE)/sarang-business-os/.dev-data/sarang.db"; npx prisma migrate status`.
- Never touch `%APPDATA%\sarang-business-os` (real user data).
