# Car Service Center

## What's included

Car Service Center is built on Sarang's shared service-business foundation — appointments, a service catalog, provider schedules, and the notification queue — plus a single dedicated module: **Job Cards**.

## Job Cards

Each job card records the client and vehicle — vehicle number, make, model, year, vehicle type (2W, 4W, Commercial, Other), odometer reading in (and out, once the vehicle is returned), the service advisor, and one or more assigned technicians.

A job card carries two line-item lists:

- **Service items** — labor charges: a name, quantity, and rate, totaled as the labor total.
- **Parts** — either typed in free text (a one-off sourced part, not tracked against stock), or added by **searching your actual inventory**, which links the line to a real Product. A linked part is what makes billing actually deduct it from stock when the job card is invoiced; a free-text part never touches inventory.

A job card moves through a status pipeline: **Received → Inspection → In Progress → (Waiting Parts, if needed) → Ready → Delivered**, with Cancelled as a separate outcome. Once Ready, a **Generate Invoice** button bills the labor and parts together as a real invoice.

Set a **next service due** date and/or odometer reading on a job card, and click **Remind** to schedule a real WhatsApp reminder to the client ahead of it. Open the **Vehicles** tab to see every distinct vehicle you've serviced, grouped by registration number with a Due Soon/Overdue badge — click **History** on any vehicle for its complete grouped service history, newest first.

The KPI bar shows active jobs, jobs ready for pickup, and jobs delivered this month.

## Language

Car Service Center is one of Sarang's 24 dedicated service-business templates, and like nearly all of them its interface is **English only**, regardless of which language you've set elsewhere in Sarang.
