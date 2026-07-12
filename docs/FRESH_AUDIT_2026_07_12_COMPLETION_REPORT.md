# Fresh-Audit Fix Cycle — Completion Report

**Date:** 2026-07-12
**Scope:** Fix every flaw identified in the founder's brutal-honesty evaluation of Sarang, with explicit authorization to rework the tax system for international credibility and to build out the Jewellery vertical with full depth — without losing any previously-built scope.

## Summary

All 16 tracked fixes are complete. Full verification is green: **0 TypeScript errors**, **1066/1066 unit tests**, **162/162 E2E checks** (119 pre-existing baseline + 43 new checks written this cycle to cover the actual new work). Two real bugs were caught and fixed during the verification pass itself — see "Bugs found during UAT" below, since that's the part worth trusting over the checklist.

## Addendum — Round 3 (same day): Print format coverage, reports coverage, branding audit, and Profit & Loss

Founder asked to verify four more things directly: (1) all billing documents support both A4 and thermal printing, (2) reports/analytics are covered for all business types, (3) Aszurex branding is present across all billing/print output — this product exists to market Aszurex, (4) cost price, selling price, and a printable Profit & Loss statement are covered.

**Ran a full research audit before touching anything.** Findings: (1) only Invoice had both A4 and thermal formats with a toggle — Quotation, Credit Note, and Debit Note were A4-only with no thermal path at all; GRN/Delivery Challan print entirely outside the shared pipeline (left as-is — deliberately scoped out, see below). (2) 28 of 41 business types had at least one vertical-specific report, but three live, selectable business types — `SERVICE` (Service Business/Agency/IT), `CONSULTANT` (Consultant/Freelancer), `REPAIR` (Repair Shop/Service Centre) — had zero. (3) Branding was already fully covered — checked all 8 print.service.ts templates and all 13 renderer-built popup-print flows, found zero gaps, nothing to fix. (4) Profit was computed correctly (`Revenue − COGS − Expenses`, using real `Product.costPrice`/`sellingPrice`) but only ever surfaced as a single locked Dashboard KPI tile — no print, no export, nothing an owner could hand to an accountant.

**Closed three real gaps:**
1. **Thermal print for Quotation, Credit Note, Debit Note** — added `generateQuotationReceiptHtml`/`generateCreditNoteReceiptHtml`/`generateDebitNoteReceiptHtml` to `print.service.ts` (same 80mm/58mm sizing conventions as Invoice's existing thermal template), wired each document's main `print` channel to respect the global Settings print-format toggle (same one Invoice already reads), and added an explicit `printReceipt` override channel + a second "Print Receipt" button on each screen, mirroring Invoice's existing Print/Print Receipt button pair exactly.
2. **Printable Profit & Loss Statement** — new `generateProfitAndLossReport` (deliberately reuses `analytics.service.ts`'s `computeProfit()` formula exactly, including its RETURN-invoice sign correction on COGS, so the new report's numbers can never disagree with the Dashboard's own Profit Estimate for the same period). Real statement layout — Revenue, less COGS, = Gross Profit, less Expenses by category, = Net Profit — with full CSV/Excel/PDF export and a chart, gated on `analytics.viewProfit` (the same Admin-only trust boundary the Dashboard tile already uses, not the more permissive `reports.financial` a Manager also holds).
3. **Project Report and Job Card Report** for the three zero-coverage business types — Project Report (status breakdown, contract value, gated on the `projects` module — covers SERVICE and CONSULTANT) and Job Card Report (status breakdown, estimated vs. actual cost, gated on `job_cards` — covers REPAIR).

**Verification**: 0 TypeScript errors, 1088/1088 unit tests (56 new — 4 P&L + 7 Project/JobCard + 45 print-template), 199/199 E2E checks (174 baseline + 25 in a new suite covering all three fixes live). All 12 non-English locales at full parity, 2226 keys.

**Deliberately not done, and why**: GRN and Delivery Challan print were left as-is (still A4-only, still outside the shared `print.service.ts` pipeline) — they're internal receiving/dispatch documents, not customer-facing bills, and the explicit ask was about "billing." Flagging this rather than silently scoping it out: if the founder wants thermal support there too, it's a bounded follow-up using the exact same pattern just shipped for Quotation/Credit/Debit Note.

## Addendum — Round 2 (same day): Jewellery depth + Architect/Civil design-plan attachment

After this report was first written, the founder asked a pointed follow-up: does Jewellery genuinely cover day-to-day activities including analytics, reports, and printing — and can Architect/Civil Engineer save design plans with customer info? An honest audit found the first report had overclaimed: only the billing/pricing engine had been verified end-to-end; analytics, reports, and print output for Jewellery did not exist, and print output actively **discarded** the purity/weight/making-charge breakdown after computing it correctly at sale time. Design-plan file attachment for Architect/Civil Engineer also didn't exist — only metadata (drawing number, revision, status).

**Closed all five gaps:**
1. **Invoice line items now persist the jewellery breakdown** (`InvoiceItem.jewelleryMetalType/Purity/NetWeight/RatePerGram/MakingCharge`, migration `20260712090000`) — previously computed correctly in the cart, then silently dropped before reaching the invoice record.
2. **Printed invoices show the breakdown** for jewellery lines (both the A4 and thermal-receipt templates).
3. **New Jewellery Report** (`generateJewelleryReport`): metal stock valuation by purity (netWeight × today's rate — not the generic Inventory Report's meaningless quantity × costPrice for a metal item), making-charge revenue over a date range, old-metal exchange summary, with a chart and full CSV/Excel/PDF export via the existing reports pipeline.
4. **New Dashboard "Jewellery Focus" widget** — today's gold rate, count of configured metal rates, quick link to exchanges — matching the existing Restaurant/Hardware/Distribution/Retail Focus cards Jewellery previously had none of.
5. **Real design-plan file attachment** for Drawing Register and Site Visit Log — extended the app's existing generic `Document` attachment system (previously used only for Invoices/Customers/Suppliers/POs/Expenses) with `DRAWING_REVISION`/`SITE_VISIT` entity types, with an expandable "Files" panel per row. Customer info was already correctly inherited (every drawing/site-visit belongs to a project, every project has a mandatory client link) — confirmed, not new.

**Two more real, previously-invisible bugs found during this round's UAT, both fixed:**
1. **Business-type switch never refreshed the Dashboard's own business-type store.** `industry.store.ts`'s `changeBusinessType()` correctly updated its own state (driving sidebar/module gating everywhere) but never touched `business.store.ts`'s separate `profile.businessType` field — so the Dashboard's Industry Spotlight widget (Restaurant/Hardware/Distribution/Retail/now Jewellery Focus) showed the *previous* business type's card until a full app reload, for every vertical, not just the new Jewellery one. Fixed by syncing both stores on a successful switch.
2. **Audit hash-chain verification produced a false "broken chain" report under real concurrent writes.** `logAction()` captures `createdAt` before entering its atomic tip-claim retry loop; under contention (surfaced live by `09-stress.js`'s concurrent-invoice burst), the row that actually wins the chain-tip claim and gets linked first can carry a *later* timestamp than the row linked immediately after it. `verifyAuditLogChain` used to sort by `createdAt`/`id` and treat that as chain order — a false mismatch on a chain that was never actually broken (confirmed: the "broken" row's `prevHash` exactly matched another row's `hash`, just one with a later timestamp). Fixed at both ends: `verifyAuditLogChain` now reconstructs true order by walking `prevHash → hash` links directly instead of trusting timestamp sort, and `logAction()` now captures `createdAt` at commit time instead of before the retry loop, closing the root cause too. Both changes are covered by a new regression test that specifically reproduces the scrambled-order scenario.

**Verification**: 0 TypeScript errors, 1071/1071 unit tests, 174/174 E2E checks (119 baseline + 55 in the new-features suite, up from 43), all 12 non-English locales at full parity (2197 keys).

**Updated Jewellery rating: 9/10.** Billing, analytics, reports, and printing are now all real and verified end-to-end. The remaining point is an honest scope gap, not a bug: no repair/job-work tracking, no EMI/chit-scheme support, no dedicated hallmarking-certificate workflow beyond the hallmark-number field.

## What was fixed (Round 1)

1. **Engagement (CA/CS) retainer invoice permanent-block bug** — `generateEngagementInvoice` now uses the same period-keyed (`YYYY-MM`) atomic claim pattern as `RetainerAgreement`, so a monthly retainer can be re-invoiced every month instead of being blocked forever after the first invoice.
2. **Pest Control contract invoicing** — contracts previously had a `contractValue` that was never billed anywhere (only ad-hoc job sheets were). Added `generateContractInvoice` with the same period-keyed claim pattern.
3. **Returns-to-invoice linkage** — replaced fragile notes-substring matching with a real `Invoice.originalInvoiceId` self-relation FK.
4. **Appointment double-booking** — added server-side `validateProviderScheduleWindow`, closing a gap where the UI prevented double-booking but the IPC layer didn't.
5. **QR order server exposure** — now binds to specific LAN interfaces + loopback (not all interfaces), with an origin allowlist.
6. **Backup destination / prompt** — fixed the default backup path and added a one-time post-login prompt nudging the owner to pick a backup destination.
7. **Agri Inputs** — removed dead config, added a real, functioning dashboard widget.
8. **Distributor aging-bucket analytics** — added a real aging-bucket summary and a 90+ days column to outstanding analytics.
9. Removed a stale, inaccurate code comment.
10. **Logistics module over-gating** fixed — bundle toggle added to Business Features settings.
11. **Tax system reworked for international credibility** — added `Customer.taxExempt`/`taxExemptReason` (reverse charge / diplomatic / NGO exemptions), billed at 0% and stamped on the invoice notes. Live-verified: an exempt customer's ₹1000 line invoices at exactly ₹1000; a normal customer's same line invoices at ₹1180 (18% GST).
12. **Jewellery vertical built with real depth** — see dedicated section below.
13. **Pharmacy batch/expiry surfaced at point of sale** in the Billing screen.
14. **Architect and Civil Engineer given real distinct depth** — Architect gets a Drawing Register (drawing number, discipline, revision, issue status); Civil Engineer gets a Site Visit Log (survey/inspection/progress-check findings, weather conditions). Previously these two verticals were byte-for-byte identical beyond their labels.
15. **i18n gaps closed** — 121 previously-untranslated keys across `quotations`/`creditNotes`/`debitNotes`/`hr` translated across all 12 non-English locales, plus full coverage for everything new (see below).
16. **Full verification pass** — this report.

## Jewellery vertical — what's actually in it

Built as a first-class business type (`JEWELLERY`), not a re-skin of an existing vertical:

- **Metal Rate management** — owner-updated gold/silver/platinum rates per purity (22K and 18K gold trade at genuinely different rates, so rates are keyed on `metalType + purity`). No internet dependency, consistent with the app's offline-forever design.
- **Weight-based product pricing** — a product can carry `metalType`, `purity`, `hallmarkNumber`, `grossWeight`, `stoneWeight` (net weight computed server-side as gross − stone), and a making charge (fixed / per-gram / percentage of metal value).
- **Live billing-time pricing** — a jewellery line in the Billing screen resolves its real price at the moment of sale from today's metal rate × net weight + making charge, not a static selling price. Quantity is locked to 1 (mirrors the existing serial-number precedent — one physical piece, one line).
- **Old-metal exchange (buyback/trade-in)** — a standalone record-keeping screen that computes exchange value from gross weight, deduction weight, and today's rate. Deliberately *not* wired directly into the core billing transaction (that function is the most money-critical, most-tested path in the app; a jeweller applies the computed credit as an ordinary invoice discount instead).
- **Full 12-language coverage** — 67 new translation keys, verified 0 missing / 0 extra against English across all locales.

**Live-verified end-to-end** (not just unit-tested): set a 22K gold rate of ₹6000/g via the real UI → created a product with 10g gross / 1g stone weight (9g net, confirmed computed correctly in the form and persisted) and a ₹500 fixed making charge → added it to a real invoice in the Billing screen → confirmed the line priced at exactly ₹54,500 (9 × 6000 + 500) and the quantity stepper was locked → submitted the invoice and confirmed the invoice total matched exactly. Also live-verified an old-metal exchange (10g gross, 1g deduction, ₹80/g silver rate → ₹720 credit, matching the formula exactly).

**Honest scope note:** this covers the day-to-day core (rate management, weight/purity-based pricing, sales, buyback) that a jewellery shop uses constantly. It does not include repair/job-work tracking, EMI/chit schemes, or a dedicated hallmarking-certificate workflow beyond the hallmark number field — flagging this now rather than overclaiming.

## Bugs found during UAT (the actual point of this pass)

The instruction was explicit: verify for real, don't just report done. Two genuine bugs surfaced this way:

1. **E2E regression (32 failing checks) — the new `BackupPromptScreen` gate.** The gate is inserted between login and the main app routes, backed by a `Setting` row (`backup_prompt_dismissed`) that defaults to `false` on any DB where it's never been set. The persistent dev/test DB already had `disclaimer_accepted=true` from historical manual use (an identical prior gate), but never had this new key — so every E2E suite except the shallow smoke/branding checks got stuck behind the prompt after login, unable to find any real screen's buttons. Root-caused by comparing against the disclaimer gate's precedent, fixed by seeding the missing `Setting` row (same as the disclaimer row already was), and confirmed by re-running the full suite to a clean 119/119.
2. **Real crash: `SiteVisit.recordedById` foreign-key violation.** `site-visit.service.ts` was auto-stamping `getCurrentSession()?.userId` (a `User.id`) directly into `recordedById`, which is a foreign key to `Employee` — a completely separate table with no relationship to `User` in this schema. Every attempt to log a site visit threw `Foreign key constraint violated`. This is the exact same class of bug already documented and fixed once before in `treatment-plan.service.ts` ("masked until now by the recordedById/createdById FK bug always throwing first") — I missed the precedent when writing the new code. Fixed by removing the auto-stamp entirely (the field now only gets set if a caller explicitly passes a real Employee id — no UI currently collects one, so it's `null` until a picker is added). Caught by driving the real UI in Playwright and reading the actual error banner, not by the "no crash" check alone (which only tests for the app's error boundary, not toast-level errors) — verified by adding the API-level check on top of it, exactly the kind of check that would have missed this if I'd trusted the crash-free UI screenshot alone.

Both are now covered by regression checks in `tests/e2e/suites/10-new-features.js` so they can't silently reappear.

## Verification results

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`, both configs) | 0 errors |
| Unit tests (`vitest run`) | 1066/1066 passed, 93 files |
| E2E — pre-existing baseline (suites 00–09) | 119/119 passed |
| E2E — new suite for this cycle's work (suite 10) | 43/43 passed |
| i18n key parity (12 non-English locales vs. English) | 0 missing / 0 extra in every locale, 2184 keys each |
| Dev DB post-run state | business type restored to MANUFACTURING, admin password randomized, no active test data |

## Files of note

- `tests/e2e/suites/10-new-features.js` (new) — live UI-driven coverage for Jewellery, tax exemption, Engagement/Pest Control recurring re-invoice, and Architect/Civil Engineer depth.
- `src/main/services/site-visit.service.ts` — bug fix (see above).
- Full list of files touched this cycle is extensive (schema, services, IPC, UI, i18n); available in the session's git-equivalent change history since this project has no git repository — ask if a full file manifest is needed.
