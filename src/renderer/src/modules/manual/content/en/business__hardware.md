# Hardware Store

Choosing **Hardware Store** as your business type turns on **area-based pricing**, **credit limit enforcement**, and the shared **Logistics** module set. Everything else — Billing, Products, Customers, Inventory, Reports — works exactly as described in those chapters; this chapter covers what's specific to a hardware store.

## Area pricing (L × W calculator)

Hardware stores often sell products priced per square foot/metre — tiles, sheets, glass, plywood — where the customer doesn't know the area off the top of their head. In **Billing**, any cart line for a Hardware business shows a small **Area** button next to its quantity stepper. Tapping it opens a length × width calculator: enter both dimensions, and Sarang computes the area and sets that as the line's quantity directly, in whatever unit the product is sold in. This doesn't change how the product is priced — it's a convenience calculator that fills in the right quantity so you don't need a separate calculator app at the counter.

## Credit limit enforcement

Hardware stores frequently sell to regular contractors and businesses on credit (pay later) terms. Give a customer a **credit limit** from their record in **Customers**, and Sarang will block any new *credit* sale that would push their outstanding balance over that limit — the invoice is rejected outright at save time with a message showing their current outstanding balance, the new invoice amount, and their limit, rather than being silently allowed and only noticed later. This check only applies to Credit-method sales; Cash, UPI, Card, and Split-payment sales (which are paid in full immediately) are never affected. A credit limit of 0 means no limit is enforced for that customer.

## Logistics & Supply Chain

Because Hardware's default template includes the Logistics modules, you also get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters.
