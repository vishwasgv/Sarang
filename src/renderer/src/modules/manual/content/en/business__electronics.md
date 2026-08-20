# Electronics

Choosing **Electronics** as your business type turns on **serial number tracking**, **IMEI tracking**, **warranty tracking**, and the shared **Logistics** module set. Everything else — Billing, Products, Customers, Inventory, Reports — works exactly as described in those chapters; this chapter covers what's specific to an electronics store.

## Serial / Device Tracking

Open **Serial Tracking** (labelled "Device & Serial Tracking" for Electronics) from the sidebar to record individual, uniquely-identified units of stock — not just "how many," but which exact unit. Add a device one at a time with its product, serial number, warranty length in months, purchase date, and cost, or use **Bulk Import** to paste a whole batch of serial numbers at once (one per line, with IMEI columns if relevant). Each device carries a status — **Available**, **Sold**, **Returned**, or **Defective** — that you can change any time from the list.

Because a serial-tracked product represents one physical unit, adding it to a cart in Billing locks its quantity to 1 — you can't "sell 3" of a specific serial number, only sell the one unit itself.

## IMEI tracking

For phones and other IMEI-carrying devices, each device record can also carry two IMEI numbers (dual-SIM). A dedicated **IMEI Lookup** box on the Serial Tracking screen lets you instantly search for a device by IMEI and see its status and warranty at a glance — useful for after-sales or repair-counter lookups.

If the Repair / RMA module is on, the Serial Tracking screen also gets a **Service Lookup** box right below IMEI Lookup — search or scan a serial number OR an IMEI and see everything about that unit in one place: what product it is, when and to whom it was sold (with the invoice and price), and its complete repair ticket history. It's built for the exact moment a customer walks up with a broken device and no paperwork — one search tells you whether they actually bought it here, when, and what's already been done to fix it. Ask Sarang (if enabled) can also answer a direct "look up serial [number]" question the same way.

## Warranty tracking

Each device's warranty is stored as a length in months from its purchase/warranty-start date, and Sarang computes and displays the actual expiry date directly next to it — shown as still valid or clearly marked **Expired** once it's passed. Ask Sarang (if enabled) can also answer "Which items are still under warranty?" directly from this data.

## Repair / RMA tickets

A sold, serial-tracked device gets a **Repair** button on Serial Tracking — open it to see that unit's full service history, or start a new repair ticket for it. A ticket carries a claim number and moves through **Received → Diagnosed → Sent to Vendor → Awaiting Parts → Repaired/Replaced → Returned to Customer** (or Cancelled, only before a replacement has actually gone out). Record which vendor you sent it to and their own RMA number if it's going out for warranty repair.

If the fix is a straight swap, choose **Replaced** and pick an in-stock unit of the same product as the replacement — Sarang marks the original unit Defective, the replacement Sold (inheriting the original sale's invoice), and deducts it from stock automatically, the same as any other sale. A repair can only be opened against a unit that was actually sold — an in-stock, never-sold device has no service history to track yet.

The moment a ticket moves to **Sent to Vendor**, Sarang starts a 30-day clock on it automatically — no extra step needed. If a unit is still sitting with the vendor past that window, it's marked **Overdue** right on the Repair Tickets list (with how many days it's actually been gone), the screen's own header shows a running overdue count, and a Dashboard alert surfaces it too, so a unit stuck with a vendor for over a month never quietly falls off your radar.

For the full picture across every open RMA, not just the overdue ones, open **Reports → RMA Aging Report**: every unit currently with a vendor, ranked from longest-gone to most-recent, with a chart showing exactly how many days each one has been out — the ones past the 30-day mark stand out in red.

When a repair ticket goes out for vendor warranty repair, you can also track what the vendor owes you back for it. Inside the ticket's detail view, click **Record Claim** and enter the amount you're claiming from the vendor — Sarang keeps a running Claimed / Recovered / Outstanding total right there. As the vendor pays you back, whether in one go or in parts, log each payment with **Record Recovery**; the claim closes itself automatically once the recovered amount reaches what was claimed. If a vendor is never going to pay out (say they reject the claim), use **Write Off** to close it without a recovery. Every open and closed claim across every ticket is summarized in **Reports → Vendor Recovery Ledger**, with total outstanding across all vendors and a chart of your largest unpaid claims.

You can also assign a technician to a repair ticket — at intake when you create it, or any time afterward from the ticket's detail view. Once a ticket has both a technician and a completed delivery date, it feeds into **Reports → Repair Turnaround by Technician**: average, fastest, and slowest turnaround time per technician, with a chart ranking them from quickest to slowest. It's a genuine service-quality number — the kind of thing that tells you who to lean on for a rush job, and who might need a hand.

## Logistics & Supply Chain

Because Electronics' default template includes the Logistics modules, you also get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters.
