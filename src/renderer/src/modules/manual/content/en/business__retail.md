# Retail

Choosing **Retail** as your business type turns on **Returns** plus the shared **Logistics** module set. Everything else — Billing, Products, Customers, Inventory, Reports — works exactly as described in those chapters; this chapter covers what's specific to a retail shop.

## Returns

Open **Returns** from the sidebar to process a customer return or exchange against a past sale. Search for the original invoice by its invoice number, and Sarang loads its items with a **Max Return** quantity for each one — this is the original quantity minus anything already returned against that same invoice on an earlier visit, so you can never accidentally return more of an item than the customer actually bought (Sarang checks and blocks this on save too, not just in the quantity stepper).

Pick the quantity to return for each item using the +/− steppers, enter a reason (required), and submit. This creates a proper **return invoice** (its own invoice number, prefixed `RET-`) that reverses the original sale's revenue, discount, and tax proportionally — it isn't a silent inventory adjustment, it's a real linked transaction you can find later from either invoice.

## Logistics & Supply Chain

Because Retail's default template includes the Logistics modules, you also get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters. A retail shop can also turn on cross-cutting extras independently from **Settings → Additional Business Features** — Barcode generation/printing and Loose/Weight billing are common choices for a retail store, but are off by default and not specific to the Retail business type.
