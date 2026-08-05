# Payroll

Open **Payroll** from the sidebar to generate, review, and pay each employee's monthly salary — built on top of the same Employee records and Attendance history covered in the HR chapter of this Manual. Viewing the payroll list and printing a payslip only needs the **View HR** permission; generating payroll, editing deductions, and marking a payslip paid all need **Manage HR**.

## Picking a period

Use the **◀** / **▶** arrows next to the month name to move between periods. Payroll is generated and tracked one calendar month at a time, for every active employee.

## Generating payroll

Tap **Generate Payroll** to create a draft payslip for every active employee who doesn't already have one for the selected month — running it again for the same month only fills in the gaps, it never creates a duplicate for someone already generated. Each payslip's **Gross Salary** is the employee's Basic Salary plus their configured Allowances (both set on the employee's own record), and how much of that gross an employee actually earns for the month depends on their Salary Type:

- **Monthly** — the full gross salary, unaffected by weekly offs, holidays, or approved leave. It's only reduced for genuine unmarked absence: each **Absent** day docks a proportional share of the month's gross, and each **Half Day** docks half that.
- **Daily** — Basic Salary is treated as a per-day rate, paid only for the days actually marked **Present** (a Half Day counts as half a day) that month, plus the fixed monthly Allowances on top.
- **Hourly** — Basic Salary is treated as a per-hour rate, calculated the same way as Daily but assuming an 8-hour day for each day present.

All of this is driven directly by that employee's Attendance records for the month — see the HR chapter's Attendance section for how those get marked day by day.

## Reviewing and adjusting a payslip

Tap any employee's row to open their payslip. It shows the Basic Salary and each Allowance line building up to the Gross Salary. While a payslip is still in **Draft** status, you can add **Deductions** — a name and an amount (PF, ESI, Professional Tax, and TDS appear as one-tap quick-add buttons whenever your business's tax model is set to GST) — and remove any deduction you've added, with the **Net Pay** total at the bottom recalculating live as you go. Tap **Save** to record your changes to the deduction list.

The disclaimer shown under the deduction list is a real one worth reading: Sarang computes gross pay and totals deductions you enter, but it does not calculate statutory PF/ESI/TDS amounts for you — those figures need to come from your own accountant or payroll rules, entered here as plain deduction lines.

## Marking a payslip paid

Once you're satisfied with the deductions, choose a **Payment Method** (Cash, Bank Transfer, Cheque, or UPI) and tap **Mark as Paid**, then confirm. This locks the payslip — a paid payslip's deductions can no longer be edited, and it now shows the date it was paid and the method used instead of the deduction editor.

## Printing a payslip

Tap the printer icon on any row in the list, or **Print Payslip** inside an open payslip, to generate a printable payslip for that employee and period — available whether the payslip is still a draft or already marked paid.
