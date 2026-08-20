# General Store

Choosing **General** as your business type doesn't turn on any industry-specific feature module — it's the plain, base version of Sarang, with the shared **Logistics** module set and **Custom Documents** enabled by default. Everything you need for day-to-day trading is already there: Billing, Products, Inventory, Customers, Suppliers, Reports, Backup, and Users & Permissions, all covered in their own chapters.

## Logistics & Supply Chain

Because General's default template includes the Logistics modules, you get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## Custom Documents

If your business needs to keep a register or log that Sarang doesn't already have a screen for — a Visitor Register, a Complaint Log, a Maintenance Book, anything at all — go to **Custom Documents** and create a new document type with whatever name fits. Once created, click **Manage Fields** on it to define exactly the fields you want to capture (text, number, date, or a dropdown list of your own options) — the same field-builder used for adding extra fields to Invoices, Customers, Suppliers, Products, and Expenses elsewhere in Sarang, just applied to a document type entirely of your own making. From there, **New Entry** logs a dated record with those fields filled in, and every entry is listed, editable, and deletable right there. You can define as many document types as you need, each with its own independent set of fields.

## Category Mix Report

Under **Reports → Category Mix**, pick a date range to see what share of your revenue each product category contributed — a pie chart plus a table of units sold, revenue, and percent of total for every category with sales in that window. This is different from **Category Sell-Through** (also available if your business has categorized products): Sell-Through tracks, month by month, how fast each category's stock is moving relative to what's on hand, while Category Mix answers a simpler, single-period question — which categories actually drive your revenue, and by how much. Categories come from whatever you've set up under Products; a product with no category assigned is left out of this report.

## Combined Cash Position Trend Report

Under **Reports → Combined Cash Position Trend**, pick a date range to see your total cash & bank balance, day by day, as a single running line — not just today's number, but how it actually got there. This reads the real posted ledger (the same "Cash & Bank" account every cash-touching transaction — payments received, expenses, supplier payments, and more — posts to), so it's a genuine combined position across every instrument, not a per-account or per-payment-method view. It's different from **Cash-Flow Projection**: that report shows each day's net movement (money in minus money out, split into what already happened and what's still due), while this one shows the actual cumulative balance itself, trending over time.

## Quote → Order → Invoice Pipeline

A Quotation can now become a **Sales Order** on the way to an invoice, instead of only ever converting straight to one. On the Quotations screen, an accepted quote gets two buttons: **Convert to Invoice** (the direct, one-shot path, unchanged) and **Convert to Sales Order** — pick the second when the customer has confirmed but you need to bill in stages, or simply want to track it as a committed order before delivery. Once a quotation becomes a Sales Order, billing continues from the Sales Order screen instead: invoice it fully in one go, or in several partial invoices over time as you fulfil it, exactly like any other Sales Order. The Sales Order itself notes which quotation it came from, so the connection between what was quoted, ordered, and eventually billed is never lost.

## Growing into a specialty

If your business later turns out to need something more specific — batch/expiry tracking like a pharmacy, serial/warranty tracking like an electronics store, size/colour variants like a clothing shop, and so on — you can switch your business type at any time from **Settings → Industry**. Nothing you've already recorded is lost; Sarang simply turns on the extra modules that type needs. You can also turn on cross-cutting extras — Returns, Barcode, Loose/Weight billing, Logistics (if you ever turn it off), and the AI Assistant — independently of your business type from **Settings → Additional Business Features**, without changing your business type at all.

Sarang also watches for this itself. If you've been on **General** for at least a week and your actual day-to-day activity clearly matches a specific pattern — carton/pack-billed products, jewellery weight-pricing fields, rentable items, kitchen order tickets, repair job cards, or appointments — a dismissible card appears on your Dashboard suggesting the template that fits, along with what it noticed (e.g. "5 products set up with carton/pack billing"). This is only ever a suggestion, never automatic: dismissing it, or ignoring it, changes nothing, and it only ever suggests one template at a time, based on whichever pattern shows up the most in your real data.
