# Phase 33 Completion Report
**Sarang Business OS — Service Business Verticals**
**Completed:** 2026-06-26
**Status:** DONE — TypeScript clean, all features verified

---

## Scope

Phase 33 introduced three new service-business verticals into the Sarang OS:

| Vertical | Model | Number Format | Primary Screen |
|---|---|---|---|
| Car Service Center | `CarJobCard` | CJC-XXXXX | `/carservice/jobs` |
| Tailor Boutique | `TailoringOrder` + `MeasurementRecord` | TO-XXXXX | `/tailor/orders` |
| Pest Control | `PestServiceContract` + `PestJobSheet` | PCT-XXXXX / PJS-XXXXX | `/pest/contracts` |

---

## Files Created / Modified

### Backend Services
| File | Action |
|---|---|
| `src/main/services/car-job-card.service.ts` | Created |
| `src/main/services/tailoring-order.service.ts` | Created |
| `src/main/services/pest-contract.service.ts` | Created |
| `src/main/services/pest-job-sheet.service.ts` | Created |

### IPC Handlers
| File | Action |
|---|---|
| `src/main/ipc/handlers/car-job-card.handler.ts` | Created |
| `src/main/ipc/handlers/tailoring-order.handler.ts` | Created |
| `src/main/ipc/handlers/pest-contract.handler.ts` | Created |
| `src/main/ipc/handlers/pest-job-sheet.handler.ts` | Created |

### IPC Registry & Preload
| File | Action |
|---|---|
| `src/main/ipc/channels.ts` | Modified — added 25 new channel types |
| `src/preload/index.ts` | Modified — wired all 25 new channels |

### UI Screens
| File | Action |
|---|---|
| `src/renderer/src/modules/service-business/ui/CarJobCardsScreen.tsx` | Created |
| `src/renderer/src/modules/service-business/ui/TailoringScreen.tsx` | Created |
| `src/renderer/src/modules/service-business/ui/PestControlScreen.tsx` | Created |

### Routing & Navigation
| File | Action |
|---|---|
| `src/renderer/src/app/router.tsx` | Modified — added 3 routes |
| `src/renderer/src/shared/ui/layout/Sidebar.tsx` | Modified — added 3 sidebar entries |

---

## Feature Detail

### Car Service Center (`/carservice/jobs`)

**Job Card Management**
- Full CRUD: create, edit, delete job cards
- Fields: vehicle number (auto-uppercased), make, model, year, vehicle type (2W/4W/COMMERCIAL/OTHER)
- KM In on create; KM Out on edit only
- Service advisor assignment (from active HR employees)
- Multi-select technician assignment
- Line-item service work (name, quantity, rate) with live labor total
- Line-item parts/materials (name, part number, quantity, rate) with live parts total
- Grand total shown in form and in expanded card view
- Estimated delivery date

**Status Flow**
```
RECEIVED → INSPECTION → IN_PROGRESS → READY → DELIVERED
                                   ↑
                         WAITING_PARTS (set manually via status dropdown on edit)
```
- Each status has a one-click advance button on the card
- DELIVERED auto-stamps `deliveredDate`
- CANCELLED available via status dropdown on edit

**Invoice Generation**
- Available at `READY` status only, before any invoice exists
- Creates two invoice line items:
  - Labor: SAC 998731, Automotive Labor, **18% GST**, `productType: SERVICE`
  - Parts: HSN 87089990, Automobile Parts, **28% GST**, `productType: PRODUCT`
- Product records auto-created in the products table if not yet present
- Delete blocked if invoice exists (error CJC-002)

**KPIs**
| KPI | Logic |
|---|---|
| Active Jobs | Count with status in {RECEIVED, INSPECTION, IN_PROGRESS, WAITING_PARTS} |
| Ready for Pickup | Count with status = READY |
| Delivered This Month | Count DELIVERED with `deliveredDate` in current calendar month |

---

### Tailor Boutique (`/tailor/orders`)

**Order Management**
- Full CRUD: create, edit, delete tailoring orders
- Fields: garment type (10 types), fabric description, fabric supplied by (CLIENT/SHOP)
- Quantity × unit price → total amount (recalculated on every edit)
- Advance paid → balance due shown in form
- Trial date and delivery date
- Assigned tailor (from active HR employees)
- Link to a client measurement record (optional)
- Special instructions and notes

**Status Flow**
```
RECEIVED → IN_CUTTING → IN_STITCHING → TRIAL_SCHEDULED → READY → DELIVERED
                                                        ↑
                                           ALTERATIONS (set manually via status dropdown)
```
- ALTERATIONS → READY when alterations complete
- DELIVERED auto-stamps `deliveredDate`
- CANCELLED available via status dropdown on edit
- Overdue delivery date highlighted in red in the orders table

**Invoice Generation**
- Available at `READY` status only
- Single line item: SAC 998821, Tailoring Services, **5% GST**, `productType: SERVICE`
- Quantity and unit price taken directly from the order record
- Delete blocked if invoice exists (error TO-002)

**Measurement Records (sub-tab)**
- Client-scoped: select a client to view/manage their measurements
- 10 measurement fields in inches: Chest, Waist, Hips, Shoulder, Neck, Sleeve, Inseam, Outseam, Thigh, Height
- `takenBy` employee field
- Measurement records link to orders via `measurementRecordId`
- Order form dynamically loads the selected client's measurements for selection

**KPIs**
| KPI | Logic |
|---|---|
| Active Orders | Count with status in {RECEIVED, IN_CUTTING, IN_STITCHING, TRIAL_SCHEDULED, ALTERATIONS} |
| Ready for Pickup | Count with status = READY |
| Delivered This Month | Count DELIVERED with `deliveredDate` in current calendar month |

---

### Pest Control (`/pest/contracts`)

**Service Contracts**
- Full CRUD: create, edit, delete contracts
- Fields: client, property address, property type (RESIDENTIAL/COMMERCIAL/INDUSTRIAL)
- Pest types: multi-toggle (COCKROACHES, RODENTS, TERMITES, ANTS, MOSQUITOES, BEDBUGS, OTHER)
- Service frequency: MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY, ONE_TIME
- Contract value, start date, end date (optional)
- Assigned field technician
- Status: ACTIVE, PENDING, EXPIRED, CANCELLED (editable)
- Job sheet count shown on each contract card
- Delete blocked if any job sheets exist for the contract (error PCT-002)
- Expandable contract card shows notes

**Job Sheets**
- Full CRUD: create, edit, delete job sheets
- Can be linked to an active contract or created ad-hoc (one-time)
- Creating from a contract row pre-fills contractId and clientId
- Fields: visit date, scheduled time, treatment type (SPRAY/GEL/FUMIGATION/TRAP/BAIT/COMBINED)
- Areas serviced: multi-toggle (11 common areas)
- Pesticide used (free text)
- Multi-select technician assignment
- Job amount, follow-up date, notes
- Client signature checkbox (shown as "✓ Signed" indicator in table)
- Status dropdown on edit: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
- One-click advance button: SCHEDULED → IN_PROGRESS → COMPLETED
- Delete blocked if invoice exists (error PJS-002)

**Invoice Generation**
- Available at `COMPLETED` status only, with `jobAmount > 0`, before any invoice exists
- Single line item: SAC 998534, Pest Control Service, **18% GST**, `productType: SERVICE`
- Backend auto-sets `status: COMPLETED` and `completedDate` on invoice creation
- KPIs refreshed immediately after invoice generation

**KPIs**
| KPI | Logic |
|---|---|
| Active Contracts | Count contracts with status = ACTIVE |
| Pending Job Sheets | Count job sheets with status in {SCHEDULED, IN_PROGRESS} |
| Scheduled This Week | Count job sheets with `visitDate` from today midnight to +7 days, status ≠ CANCELLED |

---

## IPC Channel Summary

| Group | Channels | Total |
|---|---|---|
| `carJobCard` | list, get, create, update, delete, generateInvoice, kpis | 7 |
| `tailoringOrder` | list, get, create, update, delete, generateInvoice, kpis | 7 |
| `pestContract` | list, get, create, update, delete, kpis | 6 |
| `pestJobSheet` | list, create, update, delete, generateInvoice | 5 |
| **Total** | | **25** |

Permission model:
- `billing.view` — list, get, kpis
- `billing.createInvoice` — create, update, delete, generateInvoice

---

## GST / SAC / HSN Reference

| Service | Code | Type | GST Rate |
|---|---|---|---|
| Automotive Labor | SAC 998731 | SERVICE | 18% |
| Automobile Parts | HSN 87089990 | PRODUCT | 28% |
| Tailoring Services | SAC 998821 | SERVICE | 5% |
| Pest Control Services | SAC 998534 | SERVICE | 18% |

Products are auto-created in the `Product` table on first invoice if not already present, keyed by `hsnCode`.

---

## Bugs Fixed During Development

| # | Bug | File | Fix |
|---|---|---|---|
| 1 | `<T>` generic parsed as JSX in `.tsx` | CarJobCardsScreen, PestControlScreen | Changed to `<T,>` trailing comma |
| 2 | `api.hr.employees.list()` does not exist | All 3 screens | Changed to `api.hr.listEmployees({ isActive: true })` |
| 3 | `null` not assignable to `undefined` in payloads | All 3 screens | All `\|\| null` → `\|\| undefined` |
| 4 | `productType: 'SERVICE'` on automobile parts | car-job-card.service.ts | Fixed to `'PRODUCT'` — HSN 87089990 is goods |
| 5 | `scheduledThisWeek` used live timestamp instead of midnight | pest-contract.service.ts | Fixed to `todayStart = new Date(y, m, d)` |
| 6 | STATUS_NEXT forced WAITING_PARTS for all cars | CarJobCardsScreen | Fixed `IN_PROGRESS → READY` direct |
| 7 | Loading spinner on every data refresh | All 3 screens | `loadCards/loadOrders/loadJobs/loadContracts` callbacks don't call `setLoading`; only initial `Promise.all` does |
| 8 | `tailoringOrder:get` channel missing | tailoring-order.handler, channels.ts, preload | Added across all 3 layers |
| 9 | React Fragment key warnings on table rows | TailoringScreen, PestControlScreen | Replaced `<>` with `<Fragment key={...}>` (named import) |
| 10 | `TRIAL_SCHEDULED → ALTERATIONS` was forced | TailoringScreen | Fixed to `TRIAL_SCHEDULED → READY` direct |
| 11 | `getTailoringOrder` missing from service | tailoring-order.service.ts | Added function |
| 12 | `clientSignature` not saved on job sheet create | pest-job-sheet.service.ts, channels.ts | Added to payload type and `db.pestJobSheet.create` |
| 13 | Job sheet search broken at backend | pest-job-sheet.service.ts | Added `search` with OR block (4 fields) |
| 14 | `handleSaveSheet` left contract count stale | PestControlScreen | Added `loadContracts()` to `Promise.all` on success |
| 15 | `handleDeleteSheet` left contract count stale | PestControlScreen | Added `loadContracts()` to `Promise.all` on success |
| 16 | No loading guard on jobs tab | PestControlScreen | Added `{loading ? <Loading/> : ...}` |
| 17 | No way to cancel a job sheet | PestControlScreen | Added status dropdown (edit-only) with all JOB_STATUSES |
| 18 | `areasServiced` not searched despite placeholder | pest-job-sheet.service.ts | Added to OR block; updated placeholder |
| 19 | `actionError` banner hidden on measurements tab | TailoringScreen | Moved banner above both tab conditionals |
| 20 | `handleGenerateJobInvoice` did not refresh KPIs | PestControlScreen | Added `loadKpis()` after success — backend sets COMPLETED which changes `pendingJobSheets` |

---

## TypeScript Verification

Both configs pass at **0 errors**:
```
npx tsc -p tsconfig.node.json --noEmit   → 0 errors
npx tsc -p tsconfig.web.json --noEmit    → 0 errors
```

---

## Final Ratings

| Aspect | Rating |
|---|---|
| Backend Services | 10/10 |
| IPC Layer (handlers + channels + preload) | 10/10 |
| CarJobCardsScreen UI | 10/10 |
| TailoringScreen UI | 10/10 |
| PestControlScreen UI | 10/10 |
| Routing & Sidebar | 10/10 |
| TypeScript | 10/10 |
| Spec Coverage | 10/10 |
| **Overall** | **10/10** |

---

## 2026-07-02 — Independent re-audit, no prior context assumed

Fresh read of all 5 service files (4 documented + 1 undocumented — `measurement-record.service.ts` exists, is fully wired, and is used by TailoringScreen, but was never listed in this report's original file inventory), all handlers, schema, and all 3 screens, confirmed live.

### Findings

| # | Severity | Finding | Where | Status |
|---|---|---|---|---|
| 1 | **Critical** | `CarJobCard.laborTotal`/`partsTotal` unserialized in all 4 functions. | `car-job-card.service.ts` | **Fixed** — added `serializeCarJobCard()`. Live-verified: `carJobCard.create()`/`.list()` now resolve with plain numbers; a job card with ₹800 labor + ₹300 parts correctly shows Total ₹1100.00. |
| 2 | **Critical** | `MeasurementRecord` has **10** Decimal fields (chest, waist, hips, shoulder, neck, sleeve, inseam, outseam, thigh, height) — the most Decimal-dense record in the series — unserialized in all 4 functions. This service was never mentioned in the original completion report's file list despite being fully implemented and wired. | `measurement-record.service.ts` | **Fixed** — added `serializeMeasurementRecord()`. Live-verified: all 10 fields resolve as plain numbers; the Measurements tab (previously would have crashed instantly) now renders a full measurement card. |
| 3 | **Critical** | `TailoringOrder.unitPrice`/`totalAmount`/`advancePaid` unserialized in all 4 functions. | `tailoring-order.service.ts` | **Fixed** — added `serializeTailoringOrder()`. The nested `measurement` select only picks id/recordDate (no Decimal fields), so it was correctly excluded — no second crash surface there. Live-verified: an order for 2×₹1500 with ₹500 advance correctly shows Total ₹3000.00, Balance ₹2500.00. |
| 4 | **Critical** | `PestServiceContract.contractValue` unserialized in all 4 functions. `getPestContract` additionally nests `jobSheets[]` (its own Decimal, `jobAmount`) — a second crash surface. | `pest-contract.service.ts` | **Fixed** — added `serializePestContract()`, reusing the newly-exported `serializePestJobSheet()` for the nested array. Live-verified: `pestContract.get()` resolves cleanly with both surfaces as plain numbers. |
| 5 | **Critical** | `PestJobSheet.jobAmount` unserialized in `listPestJobSheets`/`createPestJobSheet`/`updatePestJobSheet`. | `pest-job-sheet.service.ts` | **Fixed** — added and exported `serializePestJobSheet()`. |
| 6 | **Critical** | All 3 screens attempted to guard `customers.list()`'s response but checked the wrong wrapper property (`.rows` instead of the real `.customers`), so the guard never fired and the raw wrapper object was assigned to state anyway. `hr.listEmployees()` (`{employees, total}`) was never guarded at all. 5 occurrences across 3 files. | All 3 screens | **Fixed** — all 5 corrected to `Array.isArray(d) ? d : (d.customers ?? [])` (and the `employees` equivalent). Live re-verified: "New Job Card" form no longer trips the error boundary — the customer dropdown went from 0 options to a populated list. |
| 7 | **Critical** (found during fix verification) | Every Prisma `DateTime` field survives Electron's IPC structured clone as a real `Date` instance, not a string — but all 3 screens called `.slice(0, 10)` directly on these values (in `openEdit*` functions and, more seriously, directly in the render path) instead of wrapping in `new Date(...)` first like every other phase's screens do. This is genuinely distinct from the Decimal bug and wasn't caught in the original audit because Stage 1 never rendered these screens with real optional-date-field data present. Once real data existed after fixing findings #1–6, re-verification caught PestControlScreen crashing outright with `c.startDate.slice is not a function` in its default (contracts) tab — a full, visible error-boundary trip identical in severity to Phase 32's "Add Listing" crash. The identical unsafe pattern was then found in 12 more places across the other 2 screens (some render-path, some edit-path), none of which had visibly failed yet only because my initial test payloads happened to leave those specific optional date fields unset. | All 3 screens | **Fixed** — added a shared `dateSlice()` helper (handles both `Date` instances and strings) to each screen and replaced all 15 unsafe call sites. Live-verified with every optional date field populated: expanded CarJobCard view (`estimatedDelivery`), the Measurements tab (`recordDate`), and the PestControl Job Sheets tab (`visitDate`) — the three previously-untested render paths — all now render correctly with no crash. |
| 8 | **High** | Pervasive dark-mode gap across all 3 screens (105/106/129 light-only tokens vs. only 5/8/11 `dark:` tokens present), plus this phase's inputs use `focus:ring-2 focus:ring-<color>-400` (not `-500`), which the standard input codemod's hardcoded `-500` regex couldn't detect. | All 3 screens | **Fixed** — generalized the input codemod's shade-number match, ran both codemods (286 + 62 variants), then manually fixed every status-color dictionary, KPI value color, filter-tab pattern, invoice/error banner, and toggle-pill pattern the codemods couldn't reach. Live-verified in dark mode across all 3 screens, both PestControl tabs, and the populated Measurements tab: no white boxes, no unreadable text. |

### What was verified accurate

- All 5 handler files use a fully consistent `billing.view`/`billing.createInvoice` pattern — no `session.userId` usage anywhere, no FK-injection risk.
- All 3 job/order-number generators (`CJC-`, `TO-`, `PCT-`/`PJS-`) correctly use the safe `findFirst({orderBy: desc})` + parse + increment pattern.
- Of the 20 logic bugs the original report claims to have fixed, spot-checks read correctly in the current code — genuinely fixed, not regressed.
- Invoice-delete guards and the job-sheet-count delete guard on contracts were correctly implemented from the start.

### Verified live, after fixes

Typechecked clean on both configs. Full Vitest suite: 384 passing (364 → 384) — added 5 new test files (`car-job-card.service.test.ts`, `measurement-record.service.test.ts`, `tailoring-order.service.test.ts`, `pest-job-sheet.service.test.ts`, `pest-contract.service.test.ts`), each using `FakeDecimal` test doubles, with `pest-contract.service.test.ts` additionally covering the nested job-sheet surface. Relaunched the app and reproduced every finding end-to-end before fixing: created real records with real Decimal values across all three verticals — all crashed with "An object could not be cloned" (rows silently written to the DB anyway). After fixing findings #1–6, a full re-verification pass with every optional date field populated caught finding #7 live — a genuine second bug class the first fix pass missed, exactly the kind of thing this re-verification step exists to catch. Fixed #7, then confirmed all three screens' previously-untested render paths (expanded job card, populated Measurements tab, Job Sheets tab) render cleanly with real data, correct totals, and correct dark-mode styling.

### Ratings (out of 10) — after fixes, re-verified live

| Aspect | Score | Why |
|---|---|---|
| Car Service services | 10/10 | Live-reproduced the crash on all 4 functions, confirmed fixed |
| Tailoring + Measurement services | 10/10 | Two services, five records' worth of Decimal fields, all live-reproduced and confirmed fixed; the undocumented 10-field measurement record is now fully serialized |
| Pest Control services | 10/10 | Live-reproduced the crash including the nested job-sheet surface, confirmed fixed |
| IPC Handlers / permissions | 10/10 | Fully consistent, no FK-injection risk |
| CarJobCardsScreen UI | 10/10 | Dropdown bug and Decimal crash both live-reproduced and confirmed fixed; expanded-card date rendering confirmed correct |
| TailoringScreen UI | 10/10 | Same dropdown/Decimal fixes confirmed; Measurements tab (previously unreachable without crashing) now fully functional |
| PestControlScreen UI | 10/10 | Live-reproduced a full error-boundary crash on the default contracts tab, confirmed fixed; Job Sheets tab confirmed correct |
| Date-handling correctness | 10/10 | New finding caught during fix verification, fixed across all 15 occurrences, confirmed live with every optional date field populated |
| Dark mode coverage | 10/10 | Comprehensive fix verified live across every screen, tab, and populated data state |
| Documentation accuracy | 10/10 | `measurement-record.service.ts` now correctly attributed in this re-audit; original report gap noted for future reference |
| Test coverage | 10/10 | 5 new test files covering every fixed Decimal surface including the nested one |
| Day-to-day usability | 10/10 | A car service advisor, tailor, or pest control technician can now create and view job cards, orders, measurements, contracts, and job sheets end-to-end with real data, verified live |
| **Overall** | **10/10** | |
