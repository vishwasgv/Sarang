# Pharmacy

Choosing **Pharmacy** as your business type turns on **batch tracking**, **expiry tracking**, and the shared **Logistics** module set. Everything else — Billing, Products, Customers, Inventory, Reports — works exactly as described in those chapters; this chapter covers what's specific to a pharmacy.

## Batch Management

Open **Batch Management** from the sidebar to record every batch of stock you receive: product, batch/lot number, quantity received, expiry date, an optional manufacturing date, unit cost, and which supplier it came from. Each batch tracks its own **remaining quantity** separately from what was originally received, and the list can be filtered to **All**, **Expiring Soon**, or **Expired**. Alert pills at the top of the screen flag how many batches are expiring within 30 days or already expired, so a stock check is never a surprise. You can edit a batch's expiry date, manufacturing date, remaining quantity, or cost later, or deactivate a batch once it's fully used up or written off.

The **Batch Expiry** report (Reports → Batch Expiry) turns that same data into money: alongside how many batches sit in each expiry window, it now shows the real **₹ value at risk** in each bucket, so you can see at a glance not just "12 batches expiring soon" but exactly how much stock value that represents — and a separate "At-Risk Value" figure totals what's still recoverable (stock already expired is a sunk loss, not something a reorder or return can fix, so it's kept out of that total).

## How selling draws from batches

You don't pick a batch manually at sale time — Billing draws from your batch stock automatically, oldest-expiring batch first (FIFO by expiry date), for any product that has batches recorded. If the only batch stock available to cover a sale has already expired, Sarang blocks the sale by default rather than silently letting expired stock go out the door — you'd need to record a new, valid batch, or (only if genuinely intended) turn on "Allow expired batch sale" in Settings to override this. Returns on a batch-tracked product restore the quantity back to the correct batch the same way, so remaining-quantity numbers stay accurate after a return.

## Schedule H/H1 prescription drugs

Mark a product **Prescription Required** in its Product form, and Billing will require the patient's name and the prescribing doctor's name before it lets you add it to a cart — the sale simply cannot be completed without both, keeping you compliant with Schedule H/H1 record-keeping requirements. A dedicated **Prescription Drug Sales Register** report (Pharmacy only) lists every such sale with the captured patient/doctor details, and now opens with a **By Prescribing Doctor** chart above the register — which doctors are sending you the most prescription business this period, at a glance instead of scrolling the full register.

For narcotic or psychotropic medicines (Schedule H1/X — a stricter category than plain prescription-required), also check **Schedule H1/X** in the Product form (only shown once Prescription Required is already checked). Every sale of a Schedule H1/X product is captured with the same patient/doctor/date details as above, and a separate, narrower **Schedule H1/X Register** report (Reports → Schedule H1/X Register) lists only those sales — the exact subset an inspector would ask to see, without having to filter it out of the full prescription register yourself. This surfaces exactly what Sarang records (date, product, quantity, patient, doctor, invoice) — it isn't a claim of complete statutory register formatting.

## Drug license number

Enter your pharmacy's **Drug License Number** under Settings → Business Profile — it's specific to this business type and shows only when Pharmacy is your active business type.

## Auto-reorder from low stock

Set a **Default Supplier** on a product (next to its Reorder Level/Quantity in the Product form), and when that product runs low, use **Generate Reorder POs** on the low-stock alert bar in Inventory. Sarang drafts one purchase order per supplier, grouping every due product that has a default supplier configured, and skips anything already on an open PO so running it again never creates duplicates — products with no default supplier set are skipped too, with a count shown so you know what still needs manual attention.

A product that's low on stock is also checked against its own **near-expiry batch stock** before being reordered: if a meaningful quantity is due to expire soon and recent sales velocity isn't fast enough to sell it through before that happens, the reorder is suppressed rather than drafted — reordering more of something that isn't moving just buys a second batch that will also go to waste. Suppressed products are counted in the same summary message the screen already shows, so nothing is silently skipped without you knowing about it.

## Logistics & Supply Chain

Because Pharmacy's default template includes the Logistics modules, you also get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters.
