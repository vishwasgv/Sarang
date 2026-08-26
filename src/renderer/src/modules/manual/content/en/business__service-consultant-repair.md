# Service / Consultant / Repair

These are three of Sarang's original, general-purpose business types — for any business that doesn't fit a specific vertical template but does project, ticket, or repair-style work: a general contractor, a freelance consultant, a small repair shop, an IT support outfit, and similar. All three run Sarang's interface in your normal chosen language (these three are not part of the 24 specific service-vertical templates, so there's no English-only lock here).

They share one generic underlying model — Projects, Job Cards, Service Tickets, Work Tracking, and Customer History — but each business type turns on a different combination of it:

- **Service** gets Projects, Service Tickets, and Work Tracking — a business that does both project-style work and ad-hoc support requests.
- **Consultant** gets Projects and Work Tracking only, with no Job Cards or Service Tickets — a pure project/billable-hours practice.
- **Repair** gets Job Cards and Service Tickets, with no Projects — a business built around individual items customers bring in, not multi-task engagements.

All three also get **Customer History**, a unified view of everything tied to a customer regardless of which of these models produced it.

## Projects (Service, Consultant)

A project has a title, priority (Low/Medium/High/Urgent), an optional customer and assignee, an estimated hours/amount, and a due date. It moves through five statuses — Open, In Progress, On Hold, Completed, Cancelled — that you change freely from the project's detail view.

Opening a project's detail screen gives you two more things:

- **Tasks** — a simple checklist you tick off; the project list shows a "done / total" progress bar computed from this.
- **Work Logs** — hours logged against the project, each marked billable or non-billable, with a running total shown both on the list and detail views.

Got an accepted **Quotation** you use as an engagement letter? Pick it from the **Convert From Quotation** dropdown when creating a project, and Sarang links the two — one quotation can only ever convert into one project, so it's a real record of how many of your engagement letters actually became billed work.

**Consultant** also sees a running **proposal win rate** next to the project count in the header — won versus lost versus still-pending Quotations, so you always know at a glance how your pipeline of engagement letters is converting, not just how many projects are currently open.

## Job Cards (Repair, Service via the generic model)

A job card is built for a physical item a customer drops off: a title, item description, priority, estimated cost, and received/expected/delivered dates. It has its own seven-stage lifecycle — **Received → Diagnosing → In Repair → (optionally Pending Parts) → Ready → Delivered**, or **Cancelled** at any point before delivery. The detail view shows this as a visual stage tracker and always surfaces the single next action button (e.g. "Mark In Repair"), plus a dedicated "Waiting for Parts" action while a card is in repair. Delivering a job card is where you enter the actual final cost, separate from the original estimate — **Generate Invoice** turns that final cost into a real invoice once the job's been delivered.

Add real **parts used** to a job card from its detail view — search a product, set the quantity, and Sarang deducts it from your actual inventory (not a free-text note); removing a part restores the stock. Set a **warranty period** in days on delivery, and a real Under Warranty / Expired badge shows automatically from that point on. If the same item comes back for a warranty issue, start a new job card and link it as a **warranty claim** against the original — the original's live warranty status shows right there in the new job card's form.

At intake, record the item's **condition on arrival** and **accessories received** — real dispute protection, so "the customer said the charger was included" is answerable by pointing at what was actually written down when the item came in, not relying on memory. Give the job a free-text **category** (e.g. "Screen Repair," "Battery Replacement") so repair volume can be tracked by type. If you know the cost of the parts up front, enter a **quoted parts total** at intake — once real parts are added later, the job card's own detail view shows the live **parts variance** between what was quoted and what was actually used, in red if it ran over.

Sarang also flags a **repeat fault** automatically: if the same customer brings back the same item within 30 days of a prior delivery, the new job card is flagged right at creation — a real quality signal, not something you have to notice yourself.

## Service Tickets (Service, Repair)

A ticket is a lighter-weight support request: title, description, priority, an optional category tag, and an optional customer/assignee. It moves through **Open → In Progress → Resolved → Closed**, and resolving one lets you attach a resolution note. Urgent, unresolved tickets are called out with a red-flag indicator on the list so they don't get buried. Enter an amount and **Generate Invoice** to bill a resolved ticket.

Every ticket also gets an **SLA timer** the moment it's created, sized to its priority (Urgent 4 hours, High 24 hours, Medium 3 days, Low 7 days). A ticket still open past its own SLA is flagged **SLA Breached** right on the list and in the header count — a real deadline alert, not just a priority label.

Got an accepted **Quotation** that turned into real work? Pick it from the **Convert From Quotation** dropdown when creating a ticket, and Sarang links the two — one quotation can only ever convert into one ticket, so it's a real record of how many of your estimates actually became billable jobs.

## Service Contracts (Service)

Open **Service Contracts** in the sidebar to run a recurring, AMC-like arrangement for a repeat customer — a fixed value, billed on a schedule (Monthly/Quarterly/Half-Yearly/Yearly) rather than negotiated fresh every visit. Create a contract with its scope of work, frequency, start date, and value, then click **Generate Invoice** whenever a billing period is due — Sarang tracks which period was last invoiced so the same period can never be billed twice, the same protection an ordinary retainer or AMC contract already has elsewhere in Sarang.

## Retainers (Consultant)

Open **Retainers** in the sidebar to run a recurring monthly arrangement for a repeat client — fixed fee, an hourly bucket, or a deliverable-based scope, billed on a schedule you set. For an hourly-bucket retainer, log time against it from **Time Tracking** and the retainer's own card shows a live **hours used / hours allocated** progress bar, turning red once the month's allowance is exhausted — the retainer burn-down at a glance, no separate report needed.

## Reports

Six reports are specific to this vertical set. **Resolution Time by Category** breaks down how long tickets actually take to close, average/fastest/slowest per category — a real service-quality metric, not just a status count. **Repeat-Business Rate** trends, month by month, what share of your ticket-raising customers are returning versus brand new — the retention signal this generic scaffold never had before. **Utilization Rate** (Consultant) is the #1 consulting metric: billable versus non-billable hours per staff member, sorted to surface whoever needs more billable work first. **Client Profitability** (Consultant) shows revenue against hours spent per client, sorted worst-first, so you can see at a glance which clients are actually worth keeping. **Turnaround by Technician** (Repair) shows how long job cards actually take to deliver, average/fastest/slowest per technician, sorted slowest-first. **Repair Category Volume Trend** (Repair) trends monthly repair volume by category — informs what parts you should be keeping in stock.

## Appointments and Projects billing

All three of these business types also get **Appointments** (booking, provider schedules, and reminders — see the *Billing* and universal chapters) for scheduling client meetings or drop-off slots, and a Project can be billed directly with **Generate Invoice** once it's ready, the same way a Job Card or Ticket can.

## Work Tracking

A single combined timesheet across whatever this business type has enabled — a Project, a Job Card, or a Ticket — showing total hours, billable hours, and non-billable hours at a glance. Every hour logged here is billable-or-not by your choice at entry time, and each entry links back to the record it was logged against.

## Customer History

For any customer, an expandable view lists every invoice, project, service ticket, and job card tied to them in one place, each shown with its own status and date — a fast way to answer "what has this customer had done with us before" without hunting across separate screens.
