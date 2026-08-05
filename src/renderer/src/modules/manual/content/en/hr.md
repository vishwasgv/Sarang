# HR: Employees, Attendance & Leave

Open **Employees**, **Attendance**, and **Leave** from the sidebar to manage your staff — these three screens work together and feed directly into the Payroll chapter of this Manual. Viewing them only needs the **View HR** permission; adding/editing employees, marking attendance, and approving leave all need **Manage HR**.

## Employees

Tap **Add Employee** to create a staff record — name, employee number, phone, email, department, and designation are all optional except the employee's full name and join date. Pick an **Employee Type** (Full-Time, Part-Time, Contract, or Daily Wage) and a **Salary Type** (Monthly, Daily, or Hourly) — the Salary Type controls exactly how Payroll calculates pay for this person; see the Payroll chapter for the full breakdown.

Basic Salary and any **Allowances** you add here (named lines like HRA or Travel Allowance, each with its own amount) together make up the employee's Gross Salary — this whole section is clearly labelled **Reference Only**, because it's the starting figure Payroll reads from, not a payroll record itself.

If your business has a Service Catalog enabled (salons, clinics, and similar service verticals), editing an employee also shows a **Qualified Services** checklist — tick which services this staff member is trained to perform, which is what lets the appointment-booking screens offer them as a provider for those specific services.

Toggle **Show Inactive** to see former employees. **Deactivate** an employee instead of deleting them — this keeps their historical attendance, leave, and payslip records intact while removing them from active staff lists and appointment/provider pickers going forward.

## Attendance

Attendance is marked one day at a time, for every active employee, from a simple status picker: **Present**, **Absent**, **Half Day**, **Leave**, **Holiday**, or **Week Off**. Switch to a different date with the date picker at the top, use the **Mark All** shortcuts to set everyone to the same status at once (useful for a company holiday), adjust anyone who's the exception, then tap **Save Attendance**.

Switch to the **Monthly** tab for a read-only calendar-style grid — every employee as a row, every day of the month as a column, each cell showing that day's status at a glance. Useful for spotting patterns or double-checking a month before running Payroll.

**What each status actually means for pay**: a Monthly-salaried employee's pay is only reduced by **Absent** and **Half Day** days — **Week Off**, **Holiday**, and **Leave** never reduce a monthly salary, because a fixed monthly salary is supposed to stay fixed regardless of weekends, public holidays, or approved leave. Daily- and Hourly-salaried employees are paid only for the days actually marked Present (a Half Day counts as half). See the Payroll chapter for the exact calculation.

## Leave

The **Requests** tab lists every leave request, filterable by status (Pending/Approved/Rejected). Tap **New Request** to log one on an employee's behalf — pick the employee, a Leave Type, the date range (the number of days fills in automatically), and an optional reason. Picking an employee also shows their current leave balance for each type for the year, so you can see how many days they have left before submitting.

A Pending request can be **Approved** or **Rejected**. Approving checks the employee's remaining balance for that Leave Type first and blocks the approval with a clear message if it would push them over their yearly cap — nothing gets silently allowed past the limit.

The **Types** tab is where you define what kinds of leave exist at your business — Casual Leave, Sick Leave, Earned Leave, and so on ship as sensible defaults. Each type has a name, a maximum days-per-year cap, and an **Is Paid** flag for your own record-keeping of which leave types are paid versus unpaid at your business.

Approving a leave request here does not automatically mark those days as **Leave** on the Attendance screen — the two are tracked separately, so remember to also mark the corresponding days on Attendance if you want them reflected there for payroll purposes.
