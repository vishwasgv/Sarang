# Hardware Store

Choosing **Hardware Store** as your business type turns on **area-based pricing**, **credit limit enforcement**, and the shared **Logistics** module set. Everything else — Billing, Products, Customers, Inventory, Reports — works exactly as described in those chapters; this chapter covers what's specific to a hardware store.

## Area pricing (L × W calculator)

Hardware stores often sell products priced per square foot/metre — tiles, sheets, glass, plywood — where the customer doesn't know the area off the top of their head. In **Billing**, any cart line for a Hardware business shows a small **Area** button next to its quantity stepper. Tapping it opens a length × width calculator: enter both dimensions, and Sarang computes the area and sets that as the line's quantity directly, in whatever unit the product is sold in. This doesn't change how the product is priced — it's a convenience calculator that fills in the right quantity so you don't need a separate calculator app at the counter. The same calculator is available when building a **Quotation**, so an area-priced estimate is just as easy to put together as a live sale.

If you have permission to view profit figures, the calculator also shows a live **margin preview** as soon as both dimensions are filled in — the exact margin percentage this line will earn at the computed area and the line's current price, colour-coded (green/amber/red) so you can spot a thin or negative margin before you commit to the sale. A cashier without profit-viewing permission never sees this line at all, the same way margin figures are hidden from them everywhere else in Sarang.

## Carton/box unit conversion

If you buy in cartons but sell by the piece, turn on **pack billing** for a product and set how many pieces are in a pack. When you receive stock, Stock Adjustment offers a "packs received" entry mode — enter the number of packs/cartons and Sarang works out the equivalent piece count for you. Everything else (billing, low-stock alerts, valuation) keeps working in pieces as usual; this only changes how you *enter* newly received stock.

Two places read this same carton size to give you a smarter, carton-aware number instead of a bare piece count. On **Reports → Inventory Report**, a pack-billed product's stock shows both forms together — e.g. "100 (4 cartons + 4 pcs)" — so you can see at a glance whether you're down to loose pieces from an opened carton without doing the division yourself. And when you use **Inventory → Generate Reorder POs** for a pack-billed product that's fallen below its reorder level, the suggested order quantity is automatically rounded up to a whole number of cartons — a supplier sells whole cartons, not a fractional piece count, so a draft asking for "37 pieces" was never actually orderable as written.

## Damage / breakage write-off

When adjusting stock down for real damage or breakage rather than a routine correction, pick **Damage** as the reason category on the Stock Adjustment form. This records it distinctly from a generic adjustment, so your Inventory Movements history and reports can tell breakage losses apart from ordinary stock corrections.

## Credit limit enforcement

Hardware stores frequently sell to regular contractors and businesses on credit (pay later) terms. Give a customer a **credit limit** from their record in **Customers**, and Sarang will block any new *credit* sale that would push their outstanding balance over that limit — the invoice is rejected outright at save time with a message showing their current outstanding balance, the new invoice amount, and their limit, rather than being silently allowed and only noticed later. This check only applies to Credit-method sales; Cash, UPI, Card, and Split-payment sales (which are paid in full immediately) are never affected. A credit limit of 0 means no limit is enforced for that customer.

This is exactly how a contractor's **running account** works day to day: every credit sale adds to their balance the moment it happens — no separate "running account" to set up. When it's time to settle up, open **Reports → Customer Ledger**, search for the contractor, and pick the date range you want to bill for (a month, or any other period) — it produces a full statement with opening balance, every transaction in order, closing balance, and a balance-trend chart, itemized and totaled and ready to hand over or export as a PDF.

## Fast-mover vs. slow-mover matrix

On **Reports → Fast-Mover vs. Slow-Mover Matrix**, every product you sold in the date range you pick is plotted as a dot — how fast it's selling (units per day) on one axis, and its margin percentage on the other. Dashed lines mark the median velocity and median margin for that period, splitting the chart into four quadrants: fast-moving with a good margin, fast-moving but thin margin, slow-moving but still worth keeping for its margin, and slow-moving with a thin margin too — usually the clearest candidates for discontinuing or clearing out. The table below the chart lists every product with its exact velocity, margin, and quadrant, so you're never just eyeballing dots.

## Logistics & Supply Chain

Because Hardware's default template includes the Logistics modules, you also get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters.
