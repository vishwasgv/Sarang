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

## Job Cards (Repair, Service via the generic model)

A job card is built for a physical item a customer drops off: a title, item description, priority, estimated cost, and received/expected/delivered dates. It has its own seven-stage lifecycle — **Received → Diagnosing → In Repair → (optionally Pending Parts) → Ready → Delivered**, or **Cancelled** at any point before delivery. The detail view shows this as a visual stage tracker and always surfaces the single next action button (e.g. "Mark In Repair"), plus a dedicated "Waiting for Parts" action while a card is in repair. Delivering a job card is where you enter the actual final cost, separate from the original estimate.

## Service Tickets (Service, Repair)

A ticket is a lighter-weight support request: title, description, priority, an optional category tag, and an optional customer/assignee. It moves through **Open → In Progress → Resolved → Closed**, and resolving one lets you attach a resolution note. Urgent, unresolved tickets are called out with a red-flag indicator on the list so they don't get buried.

## Work Tracking

A single combined timesheet across whatever this business type has enabled — a Project, a Job Card, or a Ticket — showing total hours, billable hours, and non-billable hours at a glance. Every hour logged here is billable-or-not by your choice at entry time, and each entry links back to the record it was logged against.

## Customer History

For any customer, an expandable view lists every invoice, project, service ticket, and job card tied to them in one place, each shown with its own status and date — a fast way to answer "what has this customer had done with us before" without hunting across separate screens.
