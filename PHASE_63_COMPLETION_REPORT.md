# Phase 63 — Sales-Side Completion & Pricing Infrastructure: Completion Report

### Maintained by Aszurex | Vishwas G V | 2026-08-18

**Status: ✅ Complete** | Commits: `f9c9b6a`, `ac77529`

---

## Scope

**Why third**: the sales-side mirror of Phase 61's purchase-side work, and a direct dependency for the Five Signature Wins phases (67-69) that follow. Also carries the audit's own explicitly-named "wow factor" gap — an editable invoice template system, the single most visible customisation surface in the product.

## What shipped

13 new models covering all 11 Section 5.1 scope items:

- `SalesOrder`/`SalesOrderItem` — mirrors `PurchaseOrder`'s product-or-service duality, supports partial invoicing across multiple shipments.
- Recurring Invoices/Bills/Expenses (`RecurringProfile`) — reuses `RetainerAgreement`'s existing claim-key pattern rather than building real cron infrastructure.
- Price Lists (`PriceList`/`PriceListItem`) — tiered by quantity, resolving correctly alongside the pre-existing, narrower `CustomerClassPrice` mechanism (most-specific-wins).
- Zero-value/free-of-cost line billing plus a real scheme engine (`PricingScheme`: Buy-X-Get-Y-Free, slab discounts), enforced server-side regardless of what the client sends.
- Delivery Notes/Packing Slips — extended the existing `DeliveryChallan` model rather than duplicating it, un-gated from the opt-in Logistics module.
- Drop-shipment.
- Multi-level sales/purchase approval workflows (`ApprovalWorkflow`/`ApprovalStep`/`ApprovalInstance`/`ApprovalAction`) — fully greenfield.
- Real line-itemized Credit Notes and Vendor Credits (`CreditNoteItem`/`DebitNoteItem`) — previously lump-sum amounts with zero line detail.
- The invoice template system itself (`InvoiceTemplate`) — 4 starter templates, a thin visual layer over the existing print engine, verified byte-identical financial output regardless of template.
- Estimate→Retainer conversion.
- Configurable per-project billing methods (`ServiceProject.billingMethod`).

## Real bugs found and fixed

**A pre-existing, cross-cutting GL gap**, found and closed mid-phase, not something this phase introduced: `postInvoiceJournalEntry` (Phase 62's own GL auto-posting) was only ever called from the live Billing-screen checkout path — every invoice created via Quotation-conversion had silently never posted to the GL at all, a gap dating back further than this phase. Closed alongside this phase's own two new invoice-creation paths (Sales Orders, Recurring).

**5 real gaps found in a dedicated live-verification pass:**

1. Customer/Supplier Price List assignment had zero UI despite being fully backend-wired.
2. The Approval-status panel (`ApprovalPanel.tsx`) only fetched its data once, on mount — a user submitting an order for approval saw no panel update at all until navigating away and back.
3. Bills and Sales Orders had zero print/PDF support at all.
4. Price Lists never actually resolved at checkout anywhere except one Distributor-only screen — the universal Billing screen every business type actually uses never called the resolver.
5. A full E2E regression marathon surfaced one genuine, reproducible bug: two different "Generate Invoice" buttons sharing the identical tooltip text, a real ambiguity for a user hovering either one.

**A second, independent re-audit** (explicitly requested after the phase was already marked complete and pushed) found 3 more real gaps:

1. Packing Slip was never actually built as its own document, only Delivery Note.
2. A serious, unrelated TypeScript-interface-lies-about-reality bug: `InvoiceItem.product.productName` was assumed always-populated by the interface but the actual query never selected it, silently reading `undefined` at 5 call sites (Delivery Note creation, Packing Slip creation, the items table, Split Bill's allocation table, its mismatch-error toast) — found via a screenshot, not a text query, since `undefined` renders as blank rather than an error.
3. Drop-shipment was backend-complete but invisible on both the detail screen and the printed PO.

## Testing & verification

- Unit suite: **2425/2425** (168/168 files).
- All 13 locale files at exact key parity (3,598 keys each).
- Full `run-all.js` marathon run, every failure traced to a real cause.

## Self-review (Section 1.6 method)

| Aspect | Score | Evidence |
|---|---|---|
| Logical correctness | 10/10 | Byte-identical financial output verified across all 4 invoice templates |
| Spec coverage | 10/10 | All 11 scope items shipped, including all 8 gaps found across both audit passes |
| Day-to-day critical-feature coverage | 10/10 | Price List resolution fixed at the actual universal checkout path, not just the one screen it originally worked on |
| Testing completeness | 10/10 | Full regression marathon run, one real bug (duplicate tooltip) found and fixed |
| Language completeness | 10/10 | 13/13 locales at parity |
| Manual/Tutorial/AI integration completeness | 9/10 | Content complete and reachable, but organized differently than the original 3-chapter sketch (one combined chapter, a Settings-tour-line extension instead of a dedicated Tutorial entry for the template picker) |

## Final state

Phase 63 is complete. Commits `f9c9b6a` ("Complete Phase 63") and `ac77529` ("Close 3 more Phase 63 gaps: Packing Slip, invoice productName bug, drop-ship display").
