# Hardware Store

Choosing **Hardware Store** as your business type turns on **area-based pricing**, **credit limit enforcement**, and the shared **Logistics** module set. Everything else — Billing, Products, Customers, Inventory, Reports — works exactly as described in those chapters; this chapter covers what's specific to a hardware store.

## Area pricing (L × W calculator)

Hardware stores often sell products priced per square foot/metre — tiles, sheets, glass, plywood — where the customer doesn't know the area off the top of their head. In **Billing**, any cart line for a Hardware business shows a small **Area** button next to its quantity stepper. Tapping it opens a length × width calculator: enter both dimensions, and Sarang computes the area and sets that as the line's quantity directly, in whatever unit the product is sold in. This doesn't change how the product is priced — it's a convenience calculator that fills in the right quantity so you don't need a separate calculator app at the counter. The same calculator is available when building a **Quotation**, so an area-priced estimate is just as easy to put together as a live sale.

## Carton/box unit conversion

If you buy in cartons but sell by the piece, turn on **pack billing** for a product and set how many pieces are in a pack. When you receive stock, Stock Adjustment offers a "packs received" entry mode — enter the number of packs/cartons and Sarang works out the equivalent piece count for you. Everything else (billing, low-stock alerts, valuation) keeps working in pieces as usual; this only changes how you *enter* newly received stock.

## Damage / breakage write-off

When adjusting stock down for real damage or breakage rather than a routine correction, pick **Damage** as the reason category on the Stock Adjustment form. This records it distinctly from a generic adjustment, so your Inventory Movements history and reports can tell breakage losses apart from ordinary stock corrections.

## Credit limit enforcement

Hardware stores frequently sell to regular contractors and businesses on credit (pay later) terms. Give a customer a **credit limit** from their record in **Customers**, and Sarang will block any new *credit* sale that would push their outstanding balance over that limit — the invoice is rejected outright at save time with a message showing their current outstanding balance, the new invoice amount, and their limit, rather than being silently allowed and only noticed later. This check only applies to Credit-method sales; Cash, UPI, Card, and Split-payment sales (which are paid in full immediately) are never affected. A credit limit of 0 means no limit is enforced for that customer.

## Logistics & Supply Chain

Because Hardware's default template includes the Logistics modules, you also get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters.
