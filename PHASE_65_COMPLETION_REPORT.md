# Phase 65 — Cost Centres, Budgets & Payroll Compliance: Completion Report

### Maintained by Aszurex | Vishwas G V | 2026-08-18

**Status: ✅ Complete** | Commit: `f00f0d5`

---

## Scope

**Why fifth**: Phase 62 built a real general ledger, but every posting was business-wide — no way to ask "how is my Downtown branch actually doing." This phase segments the ledger (cost centres), gives it a forward-looking target (budgets), and turns the same transactional data into the two questions every owner actually asks: will I have enough cash, and who's slow to pay me.

## What shipped

5 scope items:

1. **`CostCentre`** — a flat (not hierarchical) list, optionally tagged onto Invoice/Bill/Expense/Employee, flowing down into the one shared journal-entry-posting chokepoint every GL write already funnels through. 100% opt-in, zero behavior change for any transaction that doesn't use it. New treemap P&L report — one rectangle per cost centre, sized by revenue, colored by margin.
2. **`Budget`** vs. real GL-derived actuals, with a paired-bar report.
3. **Statutory PF/ESI/Professional-Tax deduction engine** — deliberately designed as a configurable, owner-entered-rate *suggestion* that pre-fills the existing editable deduction line and never auto-saves, preserving this project's own earlier, explicit founder decision (2026-08-13) that a wrong auto-computed statutory number is worse than an empty field.
4. **Cash-flow projection** — actuals as a solid line, projected inflow/outflow as a dashed line built from both open invoices/bills *and* not-yet-generated recurring documents (the richer of two possible designs, not just currently-open documents).
5. **Payment performance report** — real days-to-pay per customer, derived from the actual last payment that zeroed an invoice's balance.

## Real bugs found and fixed

**In the phase's own grounding check, before any code was written** — a real, previously-undisclosed gap not spotted by any prior phase: `payroll.service.ts`'s salary-payment function created a real Expense row directly, bypassing the service function that actually posts to the GL. Every paid salary was invisible in the Trial Balance and every GL-sourced report, silently, since before this roadmap began. Closed as part of this phase's own payroll-GL-integration work, verified with a real before/after Trial Balance check confirming the ledger stays balanced once salaries start posting.

**Same bug class as Phase 64's overhead-rate gap**: `BusinessProfile.statutoryPfPercent` etc. were read by the backend from the start of this phase but had zero update path anywhere — an owner had no way to actually configure a rate short of direct database access. Fixed.

**Second, independent re-audit found 3 more real gaps:**

1. The treemap report never actually used recharts' `Treemap` component — the first pass shipped a horizontal bar chart instead, despite the spec explicitly naming a treemap.
2. Budget vs. Actual only existed inline on its own screen, not also as a standalone entry in the shared Reports picker the spec explicitly named it alongside.
3. The cash-flow projection's recurring-expense forecasting was only unit-tested, never live-verified against the real app.

**A fourth, cross-phase finding**: Ask Sarang AI's own "what can you do" capabilities answer had never been updated since Phase 62 — not updated across Phases 63 or 64 either. Fixed as a genuinely cross-phase correction, not narrowly scoped to Phase 65.

## Testing & verification

- Unit suite: **2576/2576**.
- New E2E suite `66-cost-centres-budgets-payroll.js`: grew from 40/40 to 45/45 across the fix passes.
- 13 locales at 3725/3725 key parity.

Phase 65 is the only phase in the Phase 61-66 arc to require **four** separate verification passes before every named requirement had real, live-verified evidence rather than an assumption carried forward from the first "done" claim.

## Self-review (Section 1.6 method)

| Aspect | Score | Evidence |
|---|---|---|
| Logical correctness | 10/10 | Payroll-to-GL posting bug fixed, Trial Balance re-verified balanced |
| Spec coverage | 10/10 | All 5 scope items shipped, including 2 previously-undisclosed cross-cutting bugs |
| Day-to-day critical-feature coverage | 10/10 | Statutory rate configuration given a real settable path |
| Testing completeness | 10/10 | Cash-flow recurring-expense forecasting live-verified after the second pass flagged it as unit-test-only |
| Language completeness | 10/10 | 13/13 locales at parity |
| Manual/Tutorial/AI integration completeness | 10/10 | Cross-phase AI capabilities-text staleness (dating back to Phase 62) also corrected |

## Final state

Phase 65 is complete after four independent verification passes. Commit `f00f0d5` ("Phase 65: Cost Centres, Budgets & Payroll Compliance").
