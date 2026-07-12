# Phase 54F.16 — Real Payroll: Payslips, Mark-as-Paid, Statutory Deduction Fields — Technical Spec

## 1. Audit findings (confirmed against current code, 2026-07-09)

- **No payroll model exists at all.** `hr.service.ts`'s `getMonthlySummaries()` (lines 346-429) computes `netPayable` on the fly, every time the screen loads, purely from `Employee.basicSalary`/`allowances` × attendance for the queried month. Nothing is ever persisted — there is no `SalaryPayment`/`Payroll` table in `schema.prisma` at all. Confirmed via a full grep for `salary`/`Salary`/`Payroll` across the schema: the only hits are `Employee.salaryType`/`basicSalary` and unrelated `Candidate`/`JobOrder` recruitment fields (`expectedSalary`, `offeredSalary` — a different, already-correct feature).
- **`SalaryReferenceScreen.tsx` is read-only by name and by function** — confirmed zero `isPaid`/`markPaid`/mutation calls anywhere in the file. It renders `getMonthlySummaries()`'s output in a table, nothing else. This matches the master plan's own framing exactly: a calculator, not a payroll system.
- **Zero statutory deduction fields anywhere.** `Employee` (`schema.prisma:1123-1150`) has `basicSalary`/`allowances` (JSON array of `{name, amount}` additions) but no deduction concept of any kind, statutory or otherwise — a payslip generated from current data would show gross pay only, not the real net-pay-after-deductions figure any real employee payslip needs.
- **Payroll is invisible to money reporting.** No `Expense` row, no `AuditLog` entry, nothing is ever created when "salary" happens — confirmed by grepping `expense.service.ts`/`hr.service.ts` for any cross-reference; there is none. This is the audit's flagged gap: salary is real money leaving the business every month and today it appears nowhere in Sales/Expense/P&L reporting.
- **Existing precedent for owner-configurable statutory rates**: `tax.service.ts` lets any business add/edit/delete its own tax rates (confirmed in Phase 54C's memory note and re-verified here) — the app never hardcodes GST slabs as ground truth, the owner configures what applies to them. `allowances` on `Employee` already uses the identical shape this spec needs for deductions: `String @default("[]")` JSON array of `{name, amount}`, parsed via `parseAllowances()` in `hr.service.ts`. The same shape and the same parse/serialize pattern is the obvious, already-proven fit for deductions — not a new mechanism.
- **Permission precedent**: `hr.manage` already exists with the display name *"Manage Employees & Salary Reference"* (`seed.ts:141`) — already the intended gate for anything payroll-related; no new permission needed. `hr.view` covers read access.
- **Print precedent**: every other printable document in this app (invoice, visit summary, lab report, board-meeting minutes) follows the same shape in `print.service.ts` — an `async generateXHtml()` function producing full HTML with `documentLogoUrl`/`AszurexMark` branding, opened via `webContents.print()` or `printToPDF`. A payslip follows this exact precedent, not a new document pipeline.
- **Founder decision recorded** (see the F.16 AskUserQuestion, 2026-07-09): statutory deduction fields (PF/ESI/PT/TDS) are **configurable per employee, not computed from hardcoded government formulas**. Reasoning: PF has a wage ceiling and employer/employee split that changes with EPFO notifications; ESI cuts out entirely above a gross-wage threshold; Professional Tax is state-specific with different slabs per state; TDS on salary requires an annual income-slab computation, not a flat monthly percentage. A wrong auto-computed statutory number is a worse failure mode than an empty field the owner or their CA fills in — and building real per-state PT slab tables / EPFO wage-ceiling logic pulls this app toward "accounting/compliance software," a positioning this project has deliberately avoided from the start (`[[project_strategy]]`: "never accounting software"). This mirrors exactly how `tax.service.ts` already handles GST: the app provides the *structure* (a deduction line, correctly totalled and reflected in net pay), the owner supplies the *number*.

## 2. Scope to deliver

**2.1 — Schema: a real payroll record, not a recomputed-every-time reference.**

New `SalaryPayment` model:
```
model SalaryPayment {
  id             String   @id @default(cuid())
  employeeId     String
  periodYear     Int
  periodMonth    Int                          // 1-12
  basicSalary    Float
  allowances     String   @default("[]")      // JSON snapshot: [{name, amount}] — copied from Employee at generation time, so a later Employee.allowances edit never rewrites history
  grossSalary    Float
  deductions     String   @default("[]")      // JSON: [{name, amount}] — e.g. PF, ESI, PT, TDS, Advance Recovery, Other
  totalDeductions Float   @default(0)
  netPayable     Float
  status         String   @default("DRAFT")   // DRAFT | PAID
  paidDate       DateTime?
  paymentMethod  String?                       // CASH | BANK_TRANSFER | CHEQUE | UPI — free-form-ish, matches Expense.paymentMethod's existing shape
  expenseId      String?  @unique              // set once marked PAID — the real Expense row this payroll run created
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  employee Employee @relation(fields: [employeeId], references: [id])
  expense  Expense? @relation(fields: [expenseId], references: [id])

  @@unique([employeeId, periodYear, periodMonth])   // one payroll record per employee per month — the atomic guarantee this needs
  @@index([periodYear, periodMonth])
  @@index([status])
}
```
The `@@unique([employeeId, periodYear, periodMonth])` constraint is the real correctness guarantee here (same role the atomic sequence-claim pattern plays elsewhere in this bundle) — generating payroll for a period twice fails cleanly at the DB level instead of silently creating two conflicting salary rows for the same employee/month.

**2.2 — Generate a payroll run (DRAFT), same computation `getMonthlySummaries` already does, now persisted.**
New `payroll.service.ts`: `generatePayrollForPeriod({ year, month })` computes exactly what `getMonthlySummaries()` already computes (reused, not reimplemented — attendance-based `effectiveDays`, gross salary) for every active employee who doesn't already have a `SalaryPayment` row for that period, inserts one `SalaryPayment` row per employee at `status: 'DRAFT'` with `deductions: []` (empty — the owner fills them in next). Idempotent: re-running for a period only creates rows for employees still missing one, never duplicates (the unique constraint is the backstop; the query also pre-filters).

**2.3 — Edit deductions on a DRAFT payroll record.**
`updateSalaryPayment({ id, deductions })` — recomputes `totalDeductions`/`netPayable` server-side from the submitted deduction lines (never trust a client-computed net figure), rejects if the record is already `PAID` (a paid payslip is a historical document, not an editable draft — matches how `VisitNote.isFinalized` and `Quotation` status already lock down mutable documents elsewhere in this app). Each deduction line is `{name: string, amount: number}` — the owner types "PF", "ESI", "Professional Tax", "TDS", or anything else they need (e.g. "Advance Recovery", "Loan EMI") and the amount; no dropdown of hardcoded statutory names, since a business outside India (or one that simply doesn't run PF) shouldn't be presented with irrelevant fields. A UI convenience (see 2.5) suggests the 4 common names as quick-add buttons, gated on `taxModel === 'GST'` (the same India-specific gate `report.service.ts` already uses for GSTR-1) — suggestions only, never a required or auto-computed field.

**2.4 — Mark as Paid: the real Expense linkage this audit flagged.**
`markSalaryPaid({ id, paymentMethod, paidDate })`: inside one `$transaction`, (a) re-validates the record is still `DRAFT` (guards a double-click/double-submit race the same way every other status-transition in this codebase does), (b) creates a real `Expense` row — `categoryId` resolved by finding the seeded `'Salary'` `ExpenseCategory` by name (already seeded for every install per `setup.service.ts:134`; falls back to creating it if an existing install somehow doesn't have it, same self-healing convention `seedDefaultData()` already uses elsewhere), `expenseName: "Salary — {employeeName} — {month}/{year}"`, `amount: netPayable`, (c) sets `SalaryPayment.status = 'PAID'`, `paidDate`, `expenseId`. This is the literal fix for the audit's flagged gap: salary now appears in Expense Report, P&L, and any report built on top of `Expense` — not a parallel invisible ledger.

**2.5 — Payslip document (print/PDF).**
New `generatePayslipHtml()` in `print.service.ts`, following the exact structure of `generateInvoiceHtml`/`VisitSummaryPrint`'s HTML-document precedent: business header + `AszurexMark`, employee name/designation/employee number, period, a two-column Earnings (basic + each allowance line) / Deductions (each deduction line) table, Gross / Total Deductions / **Net Pay** summary, paid-date + payment-method footer. Reuses `documentLogoUrl` for the business's own logo, same as every other printed document.

**2.6 — UI: `PayrollScreen.tsx`, replacing `SalaryReferenceScreen.tsx`'s "reference only" framing.**
Month/year picker → "Generate Payroll for This Period" (calls 2.2, gated on `hr.manage`) → a table of that period's `SalaryPayment` rows (employee, gross, deductions total, net, status badge DRAFT/PAID) → clicking a DRAFT row opens a deduction-editor panel (add/remove `{name, amount}` lines, the 4 India-specific quick-add suggestion buttons gated on `taxModel === 'GST'`, live-recomputed net-pay preview) with a "Mark as Paid" action (payment method + date, gated on `hr.manage`) → a "Print Payslip" button on any row (DRAFT or PAID, gated on `hr.view`) opens the payslip document. Route stays at the same path `SalaryReferenceScreen.tsx` currently occupies; sidebar label updates from whatever currently says "Salary Reference" to "Payroll" (confirm exact current label before renaming — don't assume, check `Sidebar.tsx` directly).

## 3. Explicitly out of scope

- **No computed PF/ESI/PT/TDS formulas** — see the founder decision in Section 1. Fields are owner-entered.
- **No annual TDS/Form 16 workflow** — TDS here is a plain monthly deduction line the owner (or their CA, working outside this app) computes and enters; no in-app annual income-tax-slab engine, no Form 16 generation.
- **No bank-file/NEFT-batch export** — `paymentMethod` is a label, not a payment-execution integration (this app makes zero outbound network/payment calls anywhere, by design — `[[project_audit_findings_2026_07]]`'s Phase-53 finding).
- **No multi-currency-aware statutory suggestions** — the India-specific quick-add deduction-name suggestions are gated on `taxModel === 'GST'`; no equivalent suggestion set is being built for other countries in this pass (an empty, fully-manual deduction editor is still available to every business regardless of country).
- **No retroactive `SalaryPayment` backfill for past months** — this starts recording payroll from whenever an owner first clicks "Generate Payroll," same as every other new-tracking-table phase in this project (F.9's `ComplianceTask` generation, F.14's `StudentTestScore`) — no fabricated history.
- **`SalaryReferenceScreen.tsx`'s existing read-only calculator is not being kept as a parallel view** — it's being replaced by `PayrollScreen.tsx`, since the whole point of this phase is that the read-only calculator was the gap. If the founder wants a pure quick-glance-without-generating-records view preserved separately, that's a fast follow-up, not assumed here.

## 4. Testing plan

- Unit: `payroll.service.ts` — `generatePayrollForPeriod` (creates one row per active employee, skips employees who already have a row for that period, correct gross-salary/effective-days math reused from the existing attendance logic, empty-employee-list no-op); `updateSalaryPayment` (recomputes totals server-side from submitted deduction lines regardless of what a client sends as "netPayable," rejects mutation on an already-PAID record); `markSalaryPaid` (creates a real Expense row with the correct amount/category, sets status/paidDate/expenseId atomically, rejects a second mark-paid attempt on the same record, rejects marking a record that's already PAID).
- Live: launch the real dev app, generate payroll for the current month, add PF/ESI/PT deduction lines to one employee's DRAFT record via the UI, confirm the net-pay preview recomputes live, mark it paid, confirm a real Expense row now exists (cross-checked via direct API call, not just a UI toast) with `categoryId` pointing at the seeded "Salary" category, print the payslip and visually confirm the earnings/deductions/net-pay table renders correctly with business branding.
