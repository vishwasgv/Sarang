# Distributor / Wholesale

Choosing **Distributor** as your business type turns on **credit limit enforcement**, **bulk order entry**, **outstanding analytics**, and the shared **Logistics** module set. Everything else — Billing, Products, Customers, Inventory, Reports — works exactly as described in those chapters; this chapter covers what's specific to a distributor/wholesale business.

## Bulk Order Entry

Open **Bulk Order Entry** from the sidebar to build a large wholesale order quickly — search and add products one by one (each new line defaults to quantity 1 and its normal selling price), then adjust quantities directly. Volume pricing kicks in automatically per line based on quantity ordered:

- 10+ units → 5% off
- 50+ units → 10% off
- 100+ units → 15% off

The highest tier the line qualifies for applies; ordinary small quantities get no discount. Search for and attach a wholesale customer to the order (required if you choose Credit as the payment method — Cash, UPI, and Card orders don't need a customer), optionally note an order reference and delivery notes, and submit — this creates a normal invoice you'll find afterward in Invoices, tagged with the bulk order reference in its notes.

## Negotiated customer pricing

Group customers into a **customer class** (from their record in Customers — e.g. "Wholesaler", "Retailer") and set class-specific prices per product from the new **Customer Pricing** screen. Once set, Bulk Order Entry (and a field rep's order below) automatically prices that customer's cart at their negotiated rate instead of the regular selling price — a customer with no class price on file simply bills at list price as before.

## Route / beat planning

A shipment can carry multiple **stops** instead of just its one destination address — open a shipment's detail and add each stop along the route with its own address and delivery status, so a single multi-drop run is tracked as the real route it is, not one destination with everything else assumed delivered at once.

## Field-rep order capture

Turn on **Field Order Capture** to let your sales reps submit orders from their own phone while out visiting customers, over your shop's WiFi — no app to install. Open **Field Orders** to see the LAN link/QR code to share with reps, and to **Accept** or **Reject** incoming requests. A rep only ever picks products and quantities — Sarang always re-checks the customer's real negotiated price (and your credit limit) at the moment you accept, not whatever the rep's phone estimated, so the invoice that's actually created is always priced correctly.

## Outstanding Analytics

Open **Outstanding Analytics** to see your total credit exposure across every wholesale customer with an unpaid balance: total outstanding, how many customers are currently over their credit limit, and the average outstanding balance per customer. An **aging** breakdown shows how long each rupee has been outstanding — Current, 1–30 days, 31–60 days, 61–90 days, 90+ days — so you can see not just how much is owed but how overdue it is. The customer list below shows each one's credit limit, current outstanding balance (with a progress bar toward their limit), and their 90+ days figure, and is sorted so anyone over their limit stands out in red. Tap any customer to jump to their full record.

## Credit limit enforcement

Give a customer a **credit limit** from their record in **Customers**, and Sarang blocks any new *credit* sale (from Billing or Bulk Order Entry) that would push their outstanding balance over that limit — rejected outright at save time with a message showing their outstanding balance, the new invoice amount, and their limit. This only applies to Credit-method sales; Cash, UPI, Card, and Split-payment sales are unaffected. A credit limit of 0 means no limit is enforced.

## Logistics & Supply Chain

Because Distributor's default template includes the Logistics modules, you also get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters.
