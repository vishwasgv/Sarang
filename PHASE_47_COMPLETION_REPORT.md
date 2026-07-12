# Phase 47 — Restaurant QR Table Ordering & Full-Stack Audit: Completion Report

## 1. Scope delivered

Per `PHASE_47_TECHNICAL_SPEC.md`: a customer scans a QR code at their table,
which opens a small static web page (served by a new local LAN HTTP
server — the first network-reachable surface in this codebase; everything
else is pure Electron IPC). The customer browses the menu and submits an
order, which creates a `TableOrderRequest` (PENDING) — it can **never**
become a real Invoice/KOT on its own. Staff, inside the authenticated
Electron app, explicitly Accept (creates a real invoice + KOT, reusing the
pre-existing `billingService.createInvoice`/`restaurantService.createKOT`
unchanged) or Reject it.

- New opt-in `TemplateModule` flag `qr_table_ordering` (defaulted OFF,
  zero footprint until enabled — matches the Phase 38 convention).
- New models `TableOrderRequest`/`TableOrderRequestItem` (additive
  migration, applied and marked in the tracker).
- New service `restaurant-order.service.ts`: customer-facing
  `listMenuProducts`/`createOrderRequest` (never trusts price from the
  client — always re-derives it from `Product.sellingPrice`/`taxRate` at
  accept time; re-validates every product is still real and active) and
  staff-facing `listOrderRequests`/`acceptOrderRequest`/`rejectOrderRequest`.
- New `src/main/server/qr-order-server.ts`: plain Node `http` server (no
  new framework dependency), started/stopped only when the module is
  toggled, serving `GET /order/:tableId` (static customer page), `GET
  /api/menu`, `GET /api/business`, `POST /api/order`. Rate-limited,
  body-size-capped, LAN-only, plain HTTP (no TLS — accepted, documented
  tradeoff, no practical cert for an ad-hoc LAN IP).
- New static customer page (`resources/qr-menu/index.html`, vanilla
  HTML/JS, no build step) and printable per-table QR code (new `qrcode`
  npm dependency), reusing the standing Aszurex print-branding rule.
- New permission `restaurant.manageOrderRequests`, granted to Manager and
  Cashier (scoped like `billing.createInvoice`, since accepting an order
  creates a real invoice) — not Kitchen Staff.

## 2. A pre-existing, unrelated dev-environment gap found and fixed during verification

While setting up a real product to test against, `Product.create()` failed:
the dev database (`.dev-data/sarang.db`) was missing several columns/tables
current `schema.prisma` already declares (Phase 38's `sellByWeight` and
siblings on `Product`, `LabelPrintLog`, a few other columns from Phases
40/41/44) — a **pre-existing** drift, not introduced by this phase, from
earlier sessions' surgical (non-reset) migration application not having
been 100% complete. This was blocking real verification of Phase 47's own
code (not just an inconvenience — any code path calling `Product.create()`
without a narrowing `select`, or any `find*` without one, would hit this).
Fixed by regenerating and applying the remaining surgical diff (`prisma
migrate diff` against the live dev DB) — confirmed safe and fully additive
(ADD COLUMN / RedefineTable-with-full-data-preservation only, no data
loss). A few cosmetic index-rename statements failed harmlessly (SQLite
auto-index already satisfies the same UNIQUE constraint under a different
internal name) and were left as-is.

## 3. Verification performed

- **TypeScript**: 0 errors, both configs.
- **Tests**: 682/682 passing (was 658 at Phase 46's close) — 23 new tests
  covering `restaurant-order.service.ts` (price-injection resistance,
  item/quantity caps, inactive-product rejection, TOCTOU-safe accept,
  invoice/KOT wiring with exact-value assertions) and
  `qr-order-server.ts` (real, non-mocked `http.Server`: module-off means
  the port is genuinely never bound — verified at the network level, not
  just the in-memory flag; module-on serves real requests; rate-limiting
  against a real flood; GET/POST rate limits tracked independently).
- **Live verification (real dev app, not just mocks)**: temporarily
  configured the dev DB as a RESTAURANT business with the module enabled
  and a real test table/product, launched the actual `npm run dev`
  Electron app, and confirmed via direct HTTP requests (simulating a
  customer's phone) that: the server actually starts and logs its port;
  the static ordering page serves correctly; `/api/menu`/`/api/business`
  return real live data; a real order submission creates a genuine
  `PENDING` `TableOrderRequest` row with only `productId`/`quantity`
  (a price-injection attempt with a fake `unitPrice` was silently
  ignored — confirmed by inspecting the stored row); an unknown table is
  rejected; the rate limiter blocks a real flood at exactly the
  configured threshold. **A real bug was caught and fixed this way**: the
  dev-mode static-page path resolution used the wrong relative depth
  (assumed the TS source-tree layout; the actual bundled app runs from a
  single `out/main/index.js`, matching `splash.html`'s existing
  resolution depth instead) — `/order/:tableId` returned 404 until fixed.
  Cleaned up all test data and restored the dev DB to its original state
  afterward.
- **Not exercised live**: full UI click-through of `RestaurantTablesScreen`/
  `KOTScreen`'s new panels (no Playwright available this session) — relied
  on TypeScript, the above real-server verification, and targeted unit
  tests instead, consistent with this project's default of skipping manual
  UI passes for non-catastrophic-risk changes.

## 4. Independent verification — 2-angle review, both money-touching and security-sensitive

Given this phase both creates real invoices and adds the app's first
unauthenticated network surface, ran 2 independent review agents (line-by-
line correctness + security focus; cross-file wiring + regression check).

### Findings, verified and fixed

1. **[HIGH]** `restaurant.manageOrderRequests` was granted to Cashier in
   `seed.ts`, but the only screen with Accept/Reject buttons
   (`RestaurantTablesScreen.tsx`) is reachable only via
   `restaurant.manageTables` (Manager/Admin only) — Cashier could never
   navigate to it, making their grant dead code. **Fixed** by moving the
   Incoming Orders panel to `KOTScreen.tsx` (reachable via
   `restaurant.viewKOT`, which Cashier already has), gated by an explicit
   `hasPermission('restaurant.manageOrderRequests')` check — not just
   screen reachability — so Kitchen Staff (who can view KOTScreen but
   lack this permission) never see Accept/Reject actions they can't use.
   This is also a better architectural fit: unconfirmed QR orders are a
   natural pre-KOT staging queue. The QR-ordering toggle and per-table
   QR-print button stay on `RestaurantTablesScreen` (setup/management
   actions, correctly Manager/Admin-only).
2. **[LOW]** The in-memory rate-limiter's `requestLog` Map never removed
   an IP once seen — on a long-running install with many distinct
   customer-phone IPs (DHCP rotation), this would grow unbounded.
   **Fixed** with a periodic sweep of stale entries, started/stopped
   alongside the server itself.
3. **[LOW]** Only `POST /api/order` was rate-limited; the two `GET`
   routes could be hit without limit. **Fixed** with a separate, more
   generous cap for GET routes — tracked independently per IP from the
   POST cap (a shared counter would have let a burst of menu page-loads
   silently exhaust the stricter order-submission limit, or vice versa;
   caught this exact bug while implementing the fix and corrected it
   before it shipped).

### Confirmed sound, no fix needed

- `acceptOrderRequest` never reads price/tax from the customer's original
  submission — always re-derived from `Product` at accept time; the
  TOCTOU case (product deactivated between order and accept) returns a
  clean error, not a crash.
- `listMenuProducts` leaks no internal fields (`costPrice`, `sku`, etc).
- All 5 new IPC handlers correctly permission-gated; `TemplateModule`
  union stays byte-identical between backend and renderer; channel/
  preload/type wiring agrees exactly; server lifecycle correctly
  starts/stops on every path that can change the module's enabled state;
  `createKOT`'s pre-existing table-occupancy/duplicate-guard behavior is
  unchanged; packaging config correctly ships the static page; the
  oversized-body path destroys the connection cleanly rather than
  crashing the shared Electron main process; the static page properly
  escapes all dynamic text (no XSS path).

## 5. Addendum — UPI payment QR on the order-confirmation screen (2026-07-08, founder request)

After order submission, the customer can now optionally pay immediately via
UPI by scanning a QR code shown on their own phone (India-specific, matches
the project's existing "no payment processing beyond UPI QR display" rule —
Sarang never verifies the payment landed, exactly like the pre-existing
UPI QR already shown on printed invoices/receipts).

- **Reused, not reinvented**: `print.service.ts`'s existing (previously
  private) `generateUpiQr()` helper — used for the invoice/thermal-receipt
  UPI QR — was generalized (its last parameter changed from a hardcoded
  `Invoice ${invoiceNumber}` construction to an arbitrary caller-supplied
  note) and exported, rather than writing a second implementation. Both
  pre-existing callers were updated to pass the exact same note text they
  built before, preserving byte-identical prior behavior.
- **Amount is always server-computed**: `createOrderRequest` now sums
  `sellingPrice × quantity` using only the same server-fetched prices
  already used for validation — never anything from the client — before
  the QR is generated. `TableOrderRequestItem` rows already store only
  `productId`/`quantity` (unchanged), so the QR amount cannot drift from
  what was actually saved.
- **Fails open, never blocks the order**: the `TableOrderRequest` is
  created and saved *before* the QR-generation step; a `generateUpiQr`
  failure is caught locally and simply omits the QR from the response —
  it can never turn a successful order submission into a failure.
- **Purely informational**: this is display-only, exactly like the
  existing printed-document UPI QR — it never marks anything as paid, and
  staff still independently select the actual received payment method
  when accepting the order in `KOTScreen`.
- Shown only when `BusinessProfile.upiId` is configured (same gate the
  printed documents already use) and the order total exceeds ₹0.01.

**Verification**: 4 new unit tests (server-computed amount, no QR without
`upiId`, QR generated with correct args when configured, QR failure
doesn't block the order) plus a live check against the real dev app with a
real UPI ID configured — confirmed the actual HTTP response for a real
₹698 order (2 × ₹349) included a genuine PNG QR data URL. Independent
review (1 angle, scoped to this addition) found no issues: price integrity
confirmed, both pre-existing `print.service.ts` callers confirmed
unchanged, failure isolation confirmed, no new trust-boundary crossing.

### 5.1 — Follow-up fix: country-gating (2026-07-08, founder question)

The founder asked directly whether this was scoped to Indian businesses
only. Checking the actual code (not assuming) found it was **not** —
neither the new QR-ordering UPI QR nor the pre-existing invoice/receipt UPI
QR (`print.service.ts`, shipped before this phase) checked
`BusinessProfile.country` at all; both only gated on whether `upiId`
happened to be filled in. UPI is exclusively an Indian payment system, so a
non-Indian business (or stale/garbage data left in that field from
switching profiles) would have shown a nonsensical UPI QR to its customers.

**Fixed in both places** (not just the new code — the pre-existing
invoice/thermal-receipt QR had the identical gap and zero test coverage
before this pass): added a shared `canShowUpiQr()` check in
`print.service.ts` requiring `upiId` **and** `country === 'IN'`, and the
same explicit country check in `restaurant-order.service.ts`'s
`createOrderRequest`. 6 new tests added (2 in `restaurant-order.service`,
4 in `print.service`, the latter closing a pre-existing zero-coverage gap
on the invoice UPI QR feature itself) covering: Indian business shows the
QR, non-Indian business never shows it even with `upiId` set, no `upiId`
means no QR, and a fully-paid invoice never shows it regardless of
country/upiId.

## 6. Final status

- 0 TypeScript errors, both configs.
- 691/691 tests passing (682 + 4 for the UPI addendum + 6 for the
  country-gating follow-up fix, less 1 test rewritten in place rather than
  added — see test files).
- 1 pre-existing (unrelated) dev-environment migration gap found and
  fixed to unblock verification.
- 2 real runtime bugs found and fixed via live verification (dev-mode
  static-page path resolution; none in the UPI addendum).
- 1 HIGH and 2 LOW findings from the original independent review, all
  fixed (including a bug introduced by fixing one of the LOW findings,
  corrected before it shipped). The UPI addendum's own review found
  nothing to fix.
- 1 real gap (missing country-gating, affecting both the new QR-ordering
  UPI QR and the pre-existing invoice/receipt UPI QR) found by the
  founder directly asking the right question, verified against the
  actual code rather than assumed, and fixed in both places.
- No open findings deferred.

Phase 47, including the UPI payment QR addendum and its country-gating
fix, is complete.
