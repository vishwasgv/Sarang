# Phase 64 — Inventory & Costing Depth: Completion Report

### Maintained by Aszurex | Vishwas G V | 2026-08-18

**Status: ✅ Complete** | Commits: `53c4bea`, `17b1ca0`

---

## Scope

**Why fourth**: Phase 61 stopped the app from silently destroying purchase-cost history; this phase turns that raw history into an actual, selectable valuation method and closes the rest of "cost is a single guessable number." Later phases (67-69) explicitly depend on it — Distributor's scheme-cost report, Jewellery's metal-rate correlation, and every new product vertical's costing needs.

## What shipped

7 scope items, all closed:

1. **Selectable valuation method** — `Product.valuationMethod: WEIGHTED_AVERAGE | FIFO | STANDARD_COST`, defaulting to Weighted Average since that was already the app's de facto behavior, just applied inconsistently. New `getProductCost()`/`getProductCostsBatch()` resolver that every COGS/margin-facing call site now goes through instead of separately re-deriving; fixed 3 stale-`costPrice` COGS reads; GRN now writes `ProductCostHistory`.
2. **Multi-location stock** — new `Location`/`LocationStock` breakdown table, additive alongside the existing single-row-per-product `Inventory` model rather than a breaking rework. Real `transferStock()` replacing an `INV-010` stub that used to just error.
3. **Job costing** — `ProductionLaborEntry` replacing a flat guessed `laborCost` number, plus configurable `overheadAllocationRate`.
4. **Landed cost** — `LandedCostAllocation`, freight/duty/handling distributed proportionally into `ProductCostHistory`, genuinely raising each item's recorded cost basis.
5. **Composite items/kits** — `Product.isKit`+`KitComponent`, one level deep only. A kit carries its own independently-set selling price and zero standalone stock, exploding into real per-component stock deductions at sale time.
6. **Reorder-level auto-PO** — confirmed already fully built pre-Phase-64, zero changes needed. A real possible outcome named up front and confirmed, not assumed — "verify, don't rebuild."
7. **Floating UoM conversion** — `Product.floatingUnitConversion`, `GRNItem.purchaseUnitQty`, for goods whose actual received quantity varies from the nominal purchase unit.

## Real bugs found and fixed

**First audit pass**: `product.service.ts`'s `createProduct()` wrote opening quantity directly to `Inventory.quantity`, completely bypassing `applyLocationDeltaTx` — every product created with opening qty > 0 had correct aggregate stock but ZERO `LocationStock` row. Invisible until a live multi-location transfer test actually tried moving that exact stock and got "Available: 0, required: 12" for a product visibly holding 30 units — traced through a screenshot after a text-based error check came back misleadingly empty. A companion test-authoring bug (a missing `result.success` assertion) had let the crash hide behind a green test; both fixed together.

**Second, independent audit pass**: `overheadAllocationBasis`/`overheadAllocationRate` were read by the job-costing backend from day one but had no update path anywhere — a business had no way to actually turn on overhead allocation short of direct database access. Fixed with schema/UI additions.

## Testing & verification

- Unit suite: **2511/2511**.
- New dedicated E2E suite: 33/33.
- 13 locales at 3663/3663 key parity.

## Self-review (Section 1.6 method)

| Aspect | Score | Evidence |
|---|---|---|
| Logical correctness | 10/10 | Multi-location stock-sync bug fixed and re-verified via a real transfer |
| Spec coverage | 10/10 | All 7 scope items closed, including reorder-level auto-PO confirmed pre-built |
| Day-to-day critical-feature coverage | 10/10 | Overhead allocation rate given a real settable path after the second pass |
| Testing completeness | 10/10 | Companion test-authoring bug (missing assertion) also fixed, not just the product bug it hid |
| Language completeness | 10/10 | 13/13 locales at parity |
| Manual/Tutorial/AI integration completeness | 10/10 | Complete |

## Final state

Phase 64 is complete, achieved only after a second independent audit pass found its second real gap — matching this roadmap arc's now-established pattern. Commits `53c4bea` ("Phase 64 backend...") and `17b1ca0` ("Complete Phase 64: ...UI, 13-language i18n, Manual/Tutorial/AI, testing").
