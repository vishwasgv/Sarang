# Phase 47 — Restaurant QR Table Ordering & Full-Stack Audit: Technical Spec

## 1. Audit findings (confirmed against current code)

- **Existing staff-driven chain is solid**: `restaurant.service.ts` — `RestaurantTable` (AVAILABLE/OCCUPIED/RESERVED), `KOT` (PENDING→IN_PROGRESS→DONE/CANCELLED, terminal-state guard at line 136), recipe-based ingredient deduction on fulfillment (`deductIngredients`), daily close. No bugs found in this pass.
- **`KOT.invoiceId` is required, not nullable** (`schema.prisma:642-652`) — a KOT cannot exist without an `Invoice` already created. Today staff build the invoice first (BillingScreen), then call `createKOT(invoiceId, tableId)`. There is no concept of an order existing before an invoice.
- **Zero QR functionality anywhere** (confirmed via full-codebase search, this session and prior).
- **Zero HTTP server anywhere in the codebase** (`grep`'d for `createServer`/`express`/`fastify`/`.listen(` — no hits). Every existing feature is pure Electron main↔renderer IPC; nothing today is reachable from another device. This is the single biggest new piece of infrastructure this phase introduces — flagged for explicit sign-off below, not something to quietly build as if it were routine.
- **Permissions**: `restaurant.viewKOT`, `restaurant.updateKOT`, `restaurant.manageTables`, `restaurant.manageRecipes` exist today (`seed.ts:131-134`). Need one new permission for reviewing/accepting customer-submitted orders.
- **`Product.imagePath`** exists on the schema — usable for a customer-facing menu without a new field.

## 2. Why a customer's phone needs a new surface, not the existing renderer

Sarang's renderer only runs inside the restaurant's own Electron window — a customer's phone can't reach it. The only way a QR code scanned at a table can open something is if the phone's browser loads a page served over the restaurant's own local WiFi network. This requires the app itself to run a small local HTTP server bound to the LAN, and serve a **separate, minimal, mobile-first static page** (not the Electron renderer) plus two JSON endpoints (`GET` the menu, `POST` an order). This stays fully consistent with offline-first/no-cloud: no internet connection is required at all, only the restaurant's own WiFi router (phone and PC on the same network) — the same LAN-only shape as any commercial restaurant QR-ordering kiosk system.

**Explicit new dependency**: `qrcode` (npm, MIT license, pure JS, no native bindings) for generating the QR images. No existing library in this codebase covers this — `jsbarcode` (Phase 38) only does 1D barcodes.

## 3. Proposed architecture (sign-off needed on this section specifically)

- **New `TemplateModule` flag: `qr_table_ordering`**, defaulted OFF for `RESTAURANT` (opt-in, matching the Phase 38 convention exactly) — when off, the HTTP server never starts, zero footprint, zero attack surface, zero port bound.
- **Local HTTP server**, started only when the module is enabled AND the app is running (no persistent Windows service — restaurant closed/app closed means ordering is unavailable, matching physical reality). Binds to the machine's LAN-reachable interface on a configurable port (default e.g. `8420`), using Node's built-in `http` module — no new web-framework dependency, this surface is small enough (2-3 routes) not to need one.
- **URL shape**: `http://<lan-ip>:<port>/order/<tableId>` — the QR code encodes this. `tableId` is the existing `RestaurantTable.id` (a `cuid()`, already opaque/non-sequential) — no separate token needed. Reachability is bounded by the restaurant's own private WiFi; guessing another table's `cuid` only lets someone order "as" a different table on the same network, not a security breach, just a minor mis-attribution risk, acceptable for this use case.
- **Plain HTTP, not HTTPS — explicit, accepted tradeoff**, documented here rather than silently glossed over: a real TLS cert isn't practical for an ad-hoc LAN IP. The only data in flight is a food order over the restaurant's own private network, the same threat model any commercial QR-ordering kiosk already accepts.
- **Two endpoints only**:
  - `GET /order/:tableId` → serves the static customer-ordering page (HTML/CSS/vanilla JS, no framework — this needs to load fast on a random customer phone with no build step or bundler required at runtime, packaged as static files under `resources/`, same pattern as `resources/splash.html`).
  - `GET /api/menu` → returns active, menu-eligible products (name, price, category, image — **never** `costPrice`, supplier data, or anything beyond what a printed menu would show).
  - `POST /api/order` → body is `{ tableId, items: [{ productId, quantity }] }` **only** — productId + quantity, nothing else trusted from the client. Price is always looked up server-side from `Product.sellingPrice` at submission time, never accepted from the request body (prevents a tampered client from submitting an arbitrary price).
- **New Prisma model — `TableOrderRequest`** (additive, matches the append-only-until-resolved pattern elsewhere in the app):
  ```prisma
  model TableOrderRequest {
    id        String   @id @default(cuid())
    tableId   String
    status    String   @default("PENDING") // PENDING | ACCEPTED | REJECTED
    notes     String?
    createdAt DateTime @default(now())
    resolvedAt DateTime?
    invoiceId String?  // set once staff accepts and an Invoice/KOT is generated

    table RestaurantTable @relation(fields: [tableId], references: [id])
    items TableOrderRequestItem[]
  }
  model TableOrderRequestItem {
    id        String @id @default(cuid())
    requestId String
    productId String
    quantity  Int
    request   TableOrderRequest @relation(fields: [requestId], references: [id])
  }
  ```
  A customer's submission never touches `Invoice`/`KOT` directly — it only ever creates a `TableOrderRequest` in `PENDING` state. **Staff must explicitly accept it** (existing `restaurant.manageTables`-permissioned user, inside the normal authenticated Electron app) before it becomes a real `Invoice` + `KOT`, reusing the exact existing `createKOT`/invoice-creation path unchanged — this phase adds a staff-side "Incoming Orders" panel on `RestaurantTablesScreen.tsx` that converts an accepted request into a normal invoice (pre-filling line items from the request) rather than inventing a second billing code path.
- **Never auto-bills or auto-confirms** — this is the deliberate default flagged in the master plan; a request sitting unconfirmed for too long should surface as a visible, timestamped queue item for staff, not silently expire or silently convert.
- **Abuse controls**: a simple in-memory rate limit per source IP on `POST /api/order` (e.g. max 5 requests/minute) and a hard cap on items-per-order and quantity-per-item, rejecting anything beyond with a plain 400 — this is the surface Phase 55 (UAT)'s flood-test will target.
- **Printable QR**: a "Print Table QR" button on `RestaurantTablesScreen.tsx` per table, generating a table-tent-style HTML page (QR image + table name/number + Aszurex branding footer, matching the standing branding rule) via the existing print pipeline.

## 4. What needs explicit founder sign-off before implementation

1. The LAN HTTP server design itself (Section 3) — this is a genuinely new capability class for Sarang (first network-reachable surface ever), not a routine feature add.
2. Plain HTTP (no TLS) as an accepted, documented tradeoff.
3. New `qrcode` npm dependency.
4. Draft-only handoff (customer submissions always require staff accept, never auto-invoice) as the permanent behavior, not just a v1 default.
5. Port choice/configurability — should the port be user-configurable in Settings (in case of a conflict with something else on the restaurant's network), or fixed?

## 5. Testing plan

- Unit: `TableOrderRequest` CRUD, accept→Invoice/KOT conversion (reusing `createKOT`), reject path, rate-limit logic, price-injection attempt (client sends a fake price, server ignores it and uses `Product.sellingPrice`), quantity/item-count cap enforcement, module-off means the HTTP server never starts (test via attempting a connection and asserting failure).
- Live: start the app with the module on, scan-equivalent manual `curl`/browser test from another device on the same LAN (or `localhost` if no second device available in this environment) confirming the menu loads and an order submission creates a `PENDING` `TableOrderRequest`, then accept it via the staff UI and confirm a real Invoice+KOT is created identically to the existing manual flow.
- Security-focused independent review pass specifically on: the new HTTP surface's input validation, whether any endpoint leaks more than menu data, rate-limiting effectiveness, and confirmation the server is truly unreachable when the module is off.

## 6. Explicitly out of scope for this phase

- Order status tracking back to the customer's phone (e.g. "your order is being prepared") — one-way submission only for v1.
- Payment through the QR flow — cash/card still happens at the table or counter as today, unchanged.
- Any change to the existing staff-driven KOT/inventory/billing chain beyond adding the new "Incoming Orders" acceptance panel.
