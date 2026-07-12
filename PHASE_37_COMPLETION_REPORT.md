# Phase 37 — Logistics & Supply Chain: Completion Report

**Project:** Sarang Business OS Lite  
**Developer:** Aszurex  
**Phase:** 37 of 36+ (Post-core expansion)  
**Completed:** 2026-06-30  
**Status:** ✅ Complete — 0 TypeScript errors, all evaluation flaws resolved

---

## 1. Overview

Phase 37 adds a full Logistics & Supply Chain management layer to Sarang Business OS Lite. It covers seven distinct functional modules — Fleet, Carriers, Shipments, GRN, Delivery Challan, Freight Ledger, and Analytics — each with its own service, IPC handler, screen, sidebar entry, and route. The module is gated by `logistics.view` / `logistics.manage` permissions and enabled per business type via the template module system.

---

## 2. Database Schema (Prisma)

Eight new models were added and pushed via `prisma db push`.

| Model | Purpose | Key Fields |
|---|---|---|
| `Vehicle` | Fleet register | vehicleNumber, vehicleType, ownerType, status (AVAILABLE/IN_TRANSIT/MAINTENANCE/RETIRED) |
| `Carrier` | Freight partner directory | name, type, ratePerKg, ratePerKm, isActive |
| `Shipment` | Outbound/inbound movement | shipmentNumber (SHP-YYYYMM-NNNN), status state machine, carrierId, vehicleId, inTransitAt, deliveredAt |
| `ShipmentItem` | Line items per shipment | productName, quantity, unit, unitValue |
| `GoodsReceiptNote` | Inbound goods receipt | grnNumber (GRN-YYYYMM-NNNN), status (DRAFT/VERIFIED/POSTED), purchaseOrderId for PO integration |
| `GRNItem` | Line items per GRN | itemName, receivedQty, rejectedQty, unitCost, batchNumber, expiryDate |
| `DeliveryChallan` | Customer dispatch document | challanNumber (DC-YYYYMM-NNNN), challanType (DELIVERY/RETURNABLE/BRANCH_TRANSFER), customerName (required), status (DRAFT/ISSUED/DELIVERED/RETURNED) |
| `ChallanItem` | Line items per challan | productName, quantity, returnedQty, unit, unitValue |
| `FreightLedger` | Freight cost tracking | carrierName (denormalized), amount, paidDate (null = PENDING), paidBy |

All foreign keys have cascade deletes where appropriate. The `FreightLedger.status` is a derived field (`paidDate !== null` = PAID) — no status column exists in the schema.

Permissions added to `seed.ts`:
- `logistics.view` — read access to all logistics screens
- `logistics.manage` — create/update/delete across all logistics modules

---

## 3. Sequential Number Generation

**Service:** `src/main/services/logistics-counter.service.ts`

Generates sequential numbers in the format `PREFIX-YYYYMM-NNNN`:
- `SHP-202601-0001` — Shipments
- `GRN-202601-0001` — Goods Receipt Notes  
- `DC-202601-0001` — Delivery Challans

The counter accepts an optional `Prisma.TransactionClient` parameter. Each create service (`createShipment`, `createGRN`, `createChallan`) wraps number generation and the record insert in a single `db.$transaction()`, making the sequence atomic. Duplicate numbers under concurrent creates are not possible.

---

## 4. Services Built

### 4.1 Vehicle Service
`src/main/services/logistics-vehicle.service.ts`

- `listVehicles` — filters by status/ownerType. Fetches `shipmentsThisMonth` via a single `groupBy` query (not N+1 per vehicle).
- `createVehicle` / `updateVehicle` — vehicle number is stored uppercase. Manual status changes reject `IN_TRANSIT` (only shipment transitions can set this).
- `deleteVehicle` — blocked if the vehicle has any shipment or challan references.
- `updateVehicleStatus` — validates allowed manual statuses (AVAILABLE, MAINTENANCE, RETIRED).

### 4.2 Carrier Service
`src/main/services/logistics-carrier.service.ts`

- Full CRUD with `toggleCarrierActive`.
- `deleteCarrier` blocked if carrier has any shipment or freight ledger references.
- Stores `ratePerKg` and `ratePerKm` for auto-suggest freight calculation in the shipment form.

### 4.3 Shipment Service
`src/main/services/logistics-shipment.service.ts`

**Status state machine:**
```
PENDING → READY → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
                ↘ CANCELLED   ↘ CANCELLED         ↘ RETURNED
```
- Transitions outside the allowed map are rejected with a clear error.
- `IN_TRANSIT` sets `inTransitAt`; `DELIVERED` sets `deliveredAt` (used for accurate delivery time analytics).
- Vehicle status side effects: `IN_TRANSIT` → vehicle becomes `IN_TRANSIT`; `DELIVERED / RETURNED / CANCELLED` → vehicle returns to `AVAILABLE`.
- `SHIPMENT_DISPATCHED` notification queued on IN_TRANSIT when `customerName` or `customerId` is set. Customer phone is resolved from the Customer table when `customerId` is present.
- `SHIPMENT_DELAYED` notification queued when transitioning to `OUT_FOR_DELIVERY` and `expectedDelivery` has already passed.

### 4.4 GRN Service
`src/main/services/logistics-grn.service.ts`

- `createGRN` — sequential number + record create are atomic in one transaction.
- `updateGRN` — edits supplier name, invoice details, notes for DRAFT/VERIFIED GRNs. POSTED GRNs are immutable.
- `postGRN` — the GRN fetch **and** all side-effect writes happen inside a single `$transaction()`:
  - Raw material stock updated + movement log written for items with `rawMaterialId`.
  - Product inventory quantity incremented for items with `productId`.
  - `PurchaseOrderItem.receivedQty` updated; PO status set to `RECEIVED` or `PARTIAL_RECEIVED` based on whether all items are fully received.
  - GRN status → POSTED, `postedAt` timestamp set.
- `GRN_POSTED` notification queued after successful post (internal, no WhatsApp link).

### 4.5 Delivery Challan Service
`src/main/services/logistics-challan.service.ts`

- `createChallan` — atomic number generation + create in one transaction.
- `updateChallanStatus` — validates terminal states (DELIVERED/RETURNED cannot be updated). On ISSUED, sets `dispatchDate` if not already provided. On RETURNED, sets `returnedAt`.
- `recordChallanReturn` — only available for `RETURNABLE` type challans. Validates that `returnedQty ≤ quantity` per item. Updates each `ChallanItem.returnedQty` and sets challan status to RETURNED in one operation.

### 4.6 Freight Ledger Service
`src/main/services/logistics-freight.service.ts`

- Schema has no `status` column — derived from `paidDate !== null`.
- `createFreightEntry` — if `carrierId` is provided but `carrierName` is omitted, the carrier name is resolved from the Carrier table automatically.
- `markFreightPaid` — sets `paidDate = new Date()`. Idempotent guard prevents double-marking. Immutable design (no delete or edit of paid entries).
- `getFreightSummary` — accepts optional date filter. Returns total / paid / pending amounts plus per-carrier breakdown.

### 4.7 Analytics Service
`src/main/services/logistics-analytics.service.ts`

Six KPI queries run in parallel via `Promise.all`. Accurate calculations:
- `avgDeliveryDays` — averaged only over shipments that have **both** `inTransitAt` and `deliveredAt` timestamps (shipments skipping IN_TRANSIT don't distort the average).
- Monthly trend — bases the 6-month window on the `to` filter date (not always `now`). Uses two single queries (shipments + freight for the window) with in-memory month grouping instead of 12 sequential DB calls.
- `topCarriers` — computed via `groupBy carrierId` then resolved to carrier names in one lookup. Returns `{ carrierId, name, count }`.

### 4.8 Notification Service
`src/main/services/logistics-notification.service.ts`

| Notification Type | Trigger | WhatsApp Link |
|---|---|---|
| `SHIPMENT_DISPATCHED` | Shipment → IN_TRANSIT | Yes (if phone available) |
| `SHIPMENT_DELAYED` | Shipment → OUT_FOR_DELIVERY with past expectedDelivery | Yes (if phone available) |
| `GRN_POSTED` | postGRN success | No (internal record) |

All three use an anchor string (`id.slice(-6)`) to deduplicate — duplicate notifications for the same record are blocked.

---

## 5. IPC Layer

**Pattern used across all 7 handlers:**
```typescript
import { requirePermission } from '../permission-guard'
type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerLogisticsXxxHandlers(handle: HandleFn): void {
  handle('logisticsXxx:action', async (raw) => {
    const deny = await requirePermission('logistics.view')
    if (deny) return deny
    return serviceFunction(raw as ...)
  })
}
```

All 7 handlers registered in `src/main/ipc/index.ts` with the `h` wrapper.

**Channel namespaces:** `logisticsVehicle`, `logisticsCarrier`, `logisticsShipment`, `logisticsGrn`, `logisticsChallan`, `logisticsFreight`, `logisticsAnalytics`

All 7 namespaces are defined in `src/main/ipc/channels.ts` and exposed in `src/preload/index.ts` as `window.api.logisticsXxx.*`.

---

## 6. Frontend Screens

### Fleet Management (`/logistics/fleet`)
- Vehicle table with status badge (IN_TRANSIT shown as read-only badge, not dropdown).
- Status dropdown for manual changes (AVAILABLE / MAINTENANCE / RETIRED).
- Add/edit modal covering all vehicle fields.
- `shipmentsThisMonth` counter per vehicle row.
- Print fleet register (all visible vehicles).

### Carriers & Partners (`/logistics/carriers`)
- Card grid with active/inactive visual distinction.
- Add/edit modal with rate-per-kg and rate-per-km fields.
- Toggle active/inactive. Delete blocked if carrier has references.
- Contact info displayed with lucide-react Phone and Mail icons.

### Shipments (`/logistics/shipments`)
- List with status color badges and per-row transition buttons (only valid next states shown).
- Freight auto-suggest: when a carrier with `ratePerKg` is selected and weight is entered, suggested freight is shown.
- Edit form fetches the full shipment record first to correctly restore `carrierId` and `vehicleId`.
- Print shipment summary.

### Goods Receipt Notes (`/logistics/grn`)
- List with expandable item rows.
- Create form with dynamic item rows (name, qty, unit, cost, batch).
- **Edit** button for DRAFT/VERIFIED GRNs opens an edit modal (supplier, invoice number, date, notes).
- Post GRN with confirmation — triggers inventory and PO updates.
- Print GRN with full item table.

### Delivery Challans (`/logistics/challan`)
- Create form with DELIVERY / RETURNABLE / BRANCH_TRANSFER type selection.
- RETURNABLE type shows `expectedReturn` date field.
- Status flow: DRAFT → Issue → Mark Delivered (for DELIVERY type).
- RETURNABLE challans show **Record Return** button that opens a per-item qty dialog, calls `recordChallanReturn` with individual quantities.
- Print challan.

### Freight Ledger (`/logistics/freight`)
- KPI summary cards (Total / Pending / Paid) computed client-side from loaded entries — always reflects the active PENDING/PAID/ALL filter.
- Mark Paid action with immutable timestamp.
- Manual carrier name entry when no carrier is selected from the dropdown.
- Print ledger.

### Logistics Analytics (`/logistics/analytics`)
- Date range filter (from / to) with Apply button.
- KPI cards: Total Shipments, Avg Delivery Days, Freight Pending, Fleet count.
- Shipment status breakdown with color-coded dots.
- Monthly trend table (6-month window based on the `to` filter date).
- **Top Carriers by Shipment Volume** — ranked list with carrier names and shipment counts.
- GRN, Challan, and Fleet summary panels.

---

## 7. Navigation & Routing

**Sidebar entries** (added after Manufacturing section):

| Label | Path | Icon | Module Gate |
|---|---|---|---|
| Fleet | /logistics/fleet | Truck | logistics_fleet |
| Carriers | /logistics/carriers | Store | logistics_carriers |
| Shipments | /logistics/shipments | Send | logistics_shipments |
| GRN | /logistics/grn | PackagePlus | logistics_grn |
| Delivery Challan | /logistics/challan | ScrollText | logistics_challan |
| Freight Ledger | /logistics/freight | Banknote | logistics_freight |
| Logistics Analytics | /logistics/analytics | BarChart2 | logistics_analytics |

All 7 routes are wrapped in `<ProtectedRoute permission="logistics.view">`.

---

## 8. Template Module System

Logistics modules are enabled for all product and service-with-goods business types:

**Gets logistics:** RESTAURANT, RETAIL, HARDWARE, DISTRIBUTOR, GENERAL, PHARMACY, ELECTRONICS, CLOTHING, FOOTWEAR, MANUFACTURING, SERVICE, CONSULTANT, REPAIR

**Does not get logistics:** All 24 Phase 22 service template types (VET_CLINIC, GP_CLINIC, BEAUTY_SALON, GYM_STUDIO, etc.) — these are pure service businesses with no physical goods movement.

---

## 9. Evaluation Flaws Found & Fixed

All 18 flaws identified in the phase evaluation were resolved:

| # | Category | Flaw | Resolution |
|---|---|---|---|
| 1 | Dead code | Unused `like` variable in counter service | Removed |
| 2 | Performance | N+1 query per vehicle in `listVehicles` | Single `groupBy` query |
| 3 | Logic | Notification skipped customerName-only shipments | Condition changed to `customerId OR customerName` |
| 4 | Missing feature | SHIPMENT_DELAYED had no generator | Added `scheduleShipmentDelayedNotification`, fires on OUT_FOR_DELIVERY with past expected date |
| 5 | Missing feature | GRN_POSTED had no generator | Added `scheduleGRNPostedNotification`, fires after successful post |
| 6 | Data integrity | `postGRN` read GRN outside transaction (stale data risk) | GRN fetch moved inside `$transaction()` |
| 7 | Analytics bug | `avgDeliveryDays` used wrong divisor | Divisor is now count of shipments with both timestamps |
| 8 | Analytics bug | Monthly trend always based on `now`, ignored date filter | Trend window now based on `to` filter date |
| 9 | Performance | Monthly trend ran 12 sequential DB queries (N+1 loop) | Replaced with 2 parallel queries + in-memory grouping |
| 10 | Analytics bug | `topCarriers` returned UUIDs, never rendered | Added name lookup; added Top Carriers section to analytics screen |
| 11 | Race condition | Counter generate + record create were two separate operations | Both wrapped in `db.$transaction()` in each create service |
| 12 | Spec violation | SERVICE / CONSULTANT / REPAIR missing logistics modules | Added `...LOGISTICS_MODULES` to all three in `TEMPLATE_DEFAULTS` |
| 13 | Unused import | `useTranslation` / `t` imported but never used in FleetScreen | Removed |
| 14 | UX / mandate | Emoji icons (📞 ✉) in CarriersScreen violated UX spec | Replaced with lucide-react `Phone` and `Mail` icons |
| 15 | Data loss | Shipment edit always reset `carrierId` and `vehicleId` to empty | `openEdit` now fetches full record via `logisticsShipment.get()` first |
| 16 | Redundant code | Client-side search filter duplicated server-side filtering | Removed client-side filter; server result used directly |
| 17 | Missing feature | GRN had no edit UI for DRAFT/VERIFIED records | Added Edit button and modal for non-posted GRNs |
| 18 | Missing feature | Challan "Mark Returned" bypassed per-item return qty tracking | Replaced with "Record Return" dialog calling `recordChallanReturn` |
| 19 | KPI mismatch | Freight summary KPIs always all-time, ignored active filter | Summary now computed client-side from filtered entries |

---

## 10. Final TypeScript Status

```
npx tsc -p tsconfig.node.json --noEmit   →  0 errors
npx tsc -p tsconfig.web.json --noEmit    →  0 errors
```

---

## 11. Files Created / Modified

### New files
```
src/main/services/logistics-counter.service.ts
src/main/services/logistics-vehicle.service.ts
src/main/services/logistics-carrier.service.ts
src/main/services/logistics-shipment.service.ts
src/main/services/logistics-grn.service.ts
src/main/services/logistics-challan.service.ts
src/main/services/logistics-freight.service.ts
src/main/services/logistics-analytics.service.ts
src/main/services/logistics-notification.service.ts
src/main/ipc/handlers/logistics-vehicle.handler.ts
src/main/ipc/handlers/logistics-carrier.handler.ts
src/main/ipc/handlers/logistics-shipment.handler.ts
src/main/ipc/handlers/logistics-grn.handler.ts
src/main/ipc/handlers/logistics-challan.handler.ts
src/main/ipc/handlers/logistics-freight.handler.ts
src/main/ipc/handlers/logistics-analytics.handler.ts
src/renderer/src/modules/logistics/ui/FleetScreen.tsx
src/renderer/src/modules/logistics/ui/CarriersScreen.tsx
src/renderer/src/modules/logistics/ui/ShipmentsScreen.tsx
src/renderer/src/modules/logistics/ui/GRNScreen.tsx
src/renderer/src/modules/logistics/ui/ChallanScreen.tsx
src/renderer/src/modules/logistics/ui/FreightLedgerScreen.tsx
src/renderer/src/modules/logistics/ui/LogisticsAnalyticsScreen.tsx
```

### Modified files
```
prisma/schema.prisma                        — 8 new models
src/main/database/seed.ts                  — logistics.view, logistics.manage permissions
src/main/ipc/channels.ts                   — 7 new IPC namespaces
src/main/ipc/index.ts                      — 7 handler registrations
src/preload/index.ts                       — 7 new api namespaces
src/main/services/industry-template.service.ts  — logistics modules for all eligible business types
src/renderer/src/app/router.tsx            — 7 new routes
src/renderer/src/app/store/industry.store.ts    — 7 new module flag types
src/renderer/src/shared/ui/layout/Sidebar.tsx   — 7 new nav items
src/renderer/src/modules/service-business/ui/NotificationQueueScreen.tsx  — 3 new type labels
```

---

## 12. Print Templates

All print outputs use `window.open()` with self-contained inline HTML. Footer on every document:

> Generated by Sarang Business OS Lite | Aszurex | www.aszurex.com

| Screen | Print output |
|---|---|
| Fleet | Fleet Register — vehicle table with status and monthly trip count |
| Shipments | Shipment summary — addresses, carrier, vehicle, tracking, freight |
| GRN | GRN detail — item table with received/rejected qty, batch, totals |
| Challan | Delivery Challan — customer, driver, vehicle, item table with returned qty |
| Freight Ledger | Freight Ledger — carrier, reference, amount, pay mode, paid date |
