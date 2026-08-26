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

## Multi-stop shipments

A shipment can carry multiple **stops** instead of just its one destination address — open a shipment's detail and add each stop along the route with its own address and delivery status, so a single multi-drop run is tracked as the real route it is, not one destination with everything else assumed delivered at once.

## Field-rep order capture

Turn on **Field Order Capture** to let your sales reps submit orders from their own phone while out visiting customers, over your shop's WiFi — no app to install. Open **Field Orders** to see the LAN link/QR code to share with reps, and to **Accept** or **Reject** incoming requests. A rep only ever picks products and quantities — Sarang always re-checks the customer's real negotiated price (and your credit limit) at the moment you accept, not whatever the rep's phone estimated, so the invoice that's actually created is always priced correctly.

## Beat Plans

Open **Beat Plans** to set each field rep's own visiting route — a named beat (e.g. "North Route, Tuesdays") with a rep, an optional day of the week, and an ordered list of customer stops. Add customers to a beat and reorder them with the up/down arrows to match the order the rep actually walks the route; a beat can be marked inactive without deleting it if a route is paused. This is separate from a delivery shipment's own stops above — a beat is a sales rep's planned customer-visit sequence, not a vehicle's freight route.

## Outstanding Analytics

Open **Outstanding Analytics** to see your total credit exposure across every wholesale customer with an unpaid balance: total outstanding, how many customers are currently over their credit limit, and the average outstanding balance per customer. An **aging** breakdown shows how long each rupee has been outstanding — Current, 1–30 days, 31–60 days, 61–90 days, 90+ days — so you can see not just how much is owed but how overdue it is. The customer list below shows each one's credit limit, current outstanding balance (with a progress bar toward their limit), and their 90+ days figure, and is sorted so anyone over their limit stands out in red. Tap any customer to jump to their full record.

## Credit limit enforcement

Give a customer a **credit limit** from their record in **Customers**, and Sarang blocks any new *credit* sale (from Billing or Bulk Order Entry) that would push their outstanding balance over that limit — rejected outright at save time with a message showing their outstanding balance, the new invoice amount, and their limit. This only applies to Credit-method sales; Cash, UPI, Card, and Split-payment sales are unaffected. A credit limit of 0 means no limit is enforced.

The limit actually enforced is **risk-adjusted**, not always the raw number on the customer's record: Sarang scores each credit customer's own payment history (currently-overdue invoices and how late past invoices were paid) into a risk tier — Low, Medium, High, or Unrated for a customer with no payment history yet — and scales the credit limit accordingly (Low risk earns 1.25× the stated limit, Medium and Unrated use it as-is, High risk is capped at 0.5×). Open a customer's own record to see their current risk tier and risk-adjusted limit next to their credit limit.

## Scheme Cost vs. Volume Report

If you run pricing schemes (Buy-X-Get-Y-Free or slab discounts — set up under Settings → Pricing Schemes), open **Scheme Cost vs. Volume** from Reports to see whether they're actually working: a chart plots what the scheme cost you (the value of free units given away, or the discount amount for a slab scheme) alongside how many units of the covered product actually sold, week by week, plus a per-scheme cost breakdown below it. This is a side-by-side comparison, not a claim that the scheme *caused* the volume — Sarang has no way to know what you would have sold without the scheme running, so read the chart as evidence to judge yourself, not a verdict.

## Field-Rep Leaderboard Report

Open **Field-Rep Leaderboard** from Reports to see how each field rep is performing: orders booked, total value, distinct customers visited, and — for a rep with an active beat plan — a hit-rate showing what share of their planned stops they actually visited. Reps are ranked best-first by value, so this reads as a leaderboard rather than a problem list. A rep with no active beat plan simply shows no hit-rate figure rather than a misleading 0%.

## Logistics & Supply Chain

Because Distributor's default template includes the Logistics modules, you also get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters.
