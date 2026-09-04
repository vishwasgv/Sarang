# Restaurant

Choosing **Restaurant** as your business type during setup turns on four things beyond the universal features every business gets: **Tables**, **Kitchen Order Tickets (KOT)**, **Recipes**, and ingredient stock tracking. Billing, Customers, Inventory, and Reports all work the same way described in their own chapters — this chapter only covers what's specific to running a restaurant.

## Tables

Open **Restaurant Tables** from the sidebar to see every table you've configured, each shown as a card with its current status: **Free**, **Busy**, or **Rsv** (Reserved). Add a table with a table number (e.g. "T1") and an optional display name. Tap a status button on a table's card to change it manually — or let a table's status follow a real order automatically, see below. A table can't be deleted while it has an active kitchen ticket. Assign a **waiter** to a table from its card so you always know who's serving it; clear the assignment any time.

**Start Order** on a free table's card opens Billing with that table already attached — build the cart as normal and tap **Send to Kitchen**. This does *not* create a bill yet: it sends a kitchen ticket for that round and the table's card switches to **View Order** / **Start Order** (Start Order again for a later round — a second course, extra drinks — sends another ticket to the same table without disturbing the first). **View Order** opens a running summary of everything ordered so far across every round, with an estimated total, and this is also where you actually bill the table: pick **Checkout**, choose a payment method (Credit requires picking a customer, same as Billing), and Sarang turns every open round into one real invoice at once. Only once that invoice exists does the card switch to **View Bill** (jumps straight to the invoice) and **Merge In**, and only then does the table free itself back to Free automatically the moment the bill is fully paid or cancelled. In short: **Start Order** feeds the kitchen, **Checkout** (from View Order) is the actual billing step — a table can carry several kitchen tickets before anyone commits to a bill at all.

**Merge In** joins a second table onto the same running bill — for a large party seated across two or more tables who want one check at the end. It only offers genuinely free tables (no order running and nothing already invoiced) as candidates, so a table mid-order is never accidentally folded away. Tap it on the table that already has the order running, pick any free table from the list, and that table now shows the same **View Bill**/**Merge In** pair, pointing at the same invoice. Add as many tables as the party actually spans.

**End of Day** is a button on this screen: it marks every occupied table available again and shows a one-line closing summary (KOTs served and today's revenue) so you can close out the dining room at the end of a shift.

## Reservations

Tap **Reservations** at the top of Restaurant Tables to see upcoming bookings and add new ones — customer name, phone, party size, date/time, an optional table, and a free-text note (dietary needs, a special occasion, anything worth knowing at seating time). A table with a reservation coming up in the next few hours shows a small "Reserved 7:30 PM" badge right on its card, so you see it while just glancing at the floor.

When the party arrives, tap **Seat** — this marks the table Busy and the reservation Seated; the reservation itself doesn't create a bill, so use **Start Order** on the table as normal once they're ready to order. **No-show** and **Cancel** close out a reservation that didn't happen, without touching the table.

## Splitting a bill

Once an order is on the books but before anything has been paid, **Split Bill** on the invoice screen divides it into two or more separate checks — pick how many checks, then set how many of each item goes on each one (a shared item, like one dessert two people are splitting, can be divided down to the individual unit). Each check becomes its own real invoice, billed and paid separately from there. The table stays Busy, now pointing at the first check, until every split check is actually settled. Splitting only changes how the bill is paid — the original kitchen ticket and the stock it already deducted are untouched.

## Tip / service charge and "86" items

On the Billing screen, use **Add Tip / Service Charge** to add a tip line to a bill without it being tied to any specific menu item or taxed as a product.

On the Products screen, toggle any menu item **86** (kitchen slang for "out of stock for today") to instantly hide it from the billing cart and the customer-facing QR menu, without deactivating the product itself — perfect for a dish that's sold out for the day but will be back on the menu tomorrow.

## Diet marking (Veg / Egg / Non-Veg)

On a menu item's product form, set **Diet Type** to Veg, Egg, or Non-Veg (Restaurant and Bakery only) to show a small colored square next to that item everywhere it appears — green for Veg, yellow for Egg, red for Non-Veg — on the Billing cart and product search, Kitchen Order Tickets, the Kitchen Display board, Waiter View, and the customer-facing QR menu (which also gets its own **Veg only** filter toggle). It's entirely optional per item; a product with no Diet Type set simply shows no marker anywhere.

## Combo / Thali Pricing

Create a combo or thali as a menu item like any other product, then open it for editing and use **Manage Kit Components** to add the individual dishes it's made of and how many of each. Set the combo's own selling price on the product itself — it's completely independent of what the individual dishes would cost separately, so a thali can be priced as a real bundle deal, not the sum of its parts. Selling a combo bills it as one clean line, but under the hood correctly deducts stock for every dish it contains, and marking its kitchen ticket **Mark Done** correctly deducts the ingredients behind each of those dishes too — the same as if each dish had been ordered on its own.

## Happy-Hour Pricing

Running a happy hour — say 20% off drinks from 4–6 PM — doesn't need a special restaurant feature: create a **Happy-Hour / Flat % Off** Pricing Scheme (Pricing Schemes, see the Sales Orders & Pricing chapter) scoped to the drinks category or a single item, and give it a daily start and end time alongside the discount. It applies itself automatically at checkout only during that window and switches off on its own the moment the window ends — no one has to remember to turn a discount on or off by hand.

## Kitchen Order Tickets (KOT)

A KOT is the kitchen's copy of an order — created either by **Send to Kitchen** on a dine-in table's order (see Tables, above) or automatically for a counter/takeaway sale. From **Kitchen Order Tickets** in the sidebar, kitchen staff see every ticket grouped by status — Pending, In Progress, Done, Cancelled — with its items and quantities, and move each one forward with a single tap (**Start Cooking** → **Mark Done**), or **Cancel** it. Each ticket can also be printed directly to your kitchen printer.

Marking a KOT **Done** is what triggers ingredient stock deduction (see below) and frees up the table it belonged to, once no other active ticket is using that table.

A dine-in ticket is titled with its table's name or number, so kitchen staff always know where an order is headed. A **counter or takeaway** ticket — no table involved — is titled with a simple daily **Token #** instead (Token #1, #2, and so on, resetting each day), so a customer waiting at the counter has a friendly number to listen for instead of an invoice number or a printed ticket code; it's also shown on the printed kitchen ticket itself, right under the header.

For a table-less sale, Billing also shows an **Order Channel** picker — **Takeaway**, **Zomato**, **Swiggy**, or **Other App** — defaulting to Takeaway. Sarang doesn't connect to Zomato/Swiggy directly (that would need permanent internet and a signed partner integration, which breaks the offline-first design) — this is a one-tap manual tag for staff keying in a phone/app order, so the ticket and the reports below can tell it apart from a real walk-in. Once tagged, both the on-screen ticket badge and the printed ticket's banner show the real channel ("ZOMATO", "SWIGGY", "DELIVERY APP") instead of the generic "TAKEAWAY" — kitchen staff know at a glance whether to hand it to a customer at the counter or package it for a rider pickup.

Once a ticket reaches **Done**, tap **Mark Served** on it to record that the food has actually reached the table (or the counter) — this is separate from the kitchen's own Done step and from billing; it exists purely so a Done ticket sitting on the pass doesn't get forgotten, and it's what the Waiter View board (below) uses to know a ticket is no longer "ready to serve."

Every ticket item also shows its **Veg / Egg / Non-Veg** marker (a small green, yellow, or red square) when that's been set on the product — see **Diet marking**, below — so kitchen staff can tell at a glance which items need separate handling.

## Kitchen hardware options

Beyond the in-app Kitchen Order Tickets screen, Sarang offers three ways to get tickets in front of kitchen staff — all three can run at once (printing a paper ticket, showing a wall monitor, and letting a phone or tablet control it are not mutually exclusive). Set these up from **Settings → Appearance**, restaurant businesses only.

**Kitchen printer.** By default, printing a KOT goes to whatever your Windows default printer is. If your kitchen printer is a different physical device than your billing counter's receipt printer, pick it from the **Kitchen Printer** dropdown — every KOT print job goes straight there from then on, no print dialog, no manual picking. Leave it on "Use Windows default printer" if you only have one printer.

**Kitchen Display — second monitor.** Turns any second monitor plugged into the billing PC into a live, large-text KOT board (Pending / In Progress / Recently Done), operated with an ordinary mouse — no touchscreen required. Under **Kitchen Display — second monitor**, pick a detected display and tap **Open Kitchen Display**; it opens full-screen there and refreshes automatically. A few physical setup notes:
- The mouse just needs to reach the PC, not the screen — if the kitchen is more than a couple of metres from the billing PC, use a **wireless mouse** (its USB receiver plugs into the billing PC) rather than a wired one, since a wired mouse's cable won't reach.
- The monitor's video cable has the same distance problem, usually worse — a plain HDMI cable starts losing signal past roughly 10-15 metres. If your kitchen is a separate room or across the restaurant (say 10-30m, possibly through a wall), use an **HDMI-over-Ethernet extender kit** (a cheap sender/receiver pair connected by a standard network cable) rather than a single long HDMI cable.
- In Windows Display settings, make sure the second monitor is set to **Extend these displays**, not Duplicate — that's what lets your one mouse cursor move across onto it.
- If running a cable that far turns out to be impractical, use the phone/tablet/laptop option below instead — it needs no cabling at all.

**Kitchen Display — phone / tablet / laptop.** Lets any phone, tablet, or laptop connected to your shop's WiFi open a live KOT board in its own browser — no app to install, a tablet propped up in the kitchen works exactly the same way as a phone or laptop here. Turn it on under **Kitchen Display — phone / laptop**, then either read out the LAN address(es) shown or tap **Show QR code** and have the device scan it. This works entirely over your own WiFi, no internet required, and is completely separate from the customer-facing QR table ordering feature below (different server, different port, and a random access code that's only ever shown here in Settings — a customer who scans their table's ordering QR code has no way to reach the kitchen board). If access ever needs to be revoked (e.g. a phone with the link is lost), tap **Regenerate access code** — every previously shared link/QR code stops working immediately.

## Waiter View — a live order board on each waiter's own phone

Beyond the shared Kitchen Display board, Sarang can give each individual waiter their own personal, phone-sized view of just the tables assigned to them. From **Restaurant Tables**, find the **Waiter View** card (it appears once you have at least one employee and Kitchen Display — phone/tablet/laptop is turned on, since it runs on that same local server) and tap a waiter's name to generate their QR code; **Print** it and hand it to them, or let them scan it directly off the screen.

Scanning it opens **My Tables** on their own phone — every table currently assigned to that waiter, each order's items grouped with the same diet markers and status you'd see on the Kitchen Display board (what's still cooking, what's ready to serve), and a **Mark Served** button right there so they can clear a ticket the moment they've actually delivered it, without walking back to a shared screen. A floating **+** button lets them pick any table and place a new order directly — useful for a table that's reluctant to scan their own QR code and would rather just tell the waiter what they want; the order goes straight to the kitchen the same way a customer's own QR order would, no separate approval step needed since it's staff placing it.

Each waiter's link only works while they're an active employee — deactivating someone in **Employees** immediately locks their board (and any copy of their printed QR code) out, since that check happens fresh on every request, not just when the QR is first generated. That's the right way to cut off someone who's left. If instead a *current* waiter's phone is lost or their QR code ends up somewhere it shouldn't, deactivating and re-activating them won't help by itself — the link isn't unique to them, it shares the same access code as the Kitchen Display board — so use **Regenerate access code** under Kitchen Display — phone/laptop (Settings → Appearance) to invalidate every waiter and kitchen-display link at once, then reprint fresh QR codes for whoever still needs one.

## Recipes and ingredient tracking

Open **Recipes** to link a menu item (e.g. "Masala Chai") to the raw ingredients it consumes and how much of each — search for the menu product, name the recipe, then add ingredient rows (each ingredient can only appear once per recipe; combine quantities instead of adding a duplicate row). Every recipe's ingredient list is shown expanded in the list view.

Once a recipe exists for a menu item, completing its KOT (marking it Done) automatically deducts the recipe's ingredient quantities × the quantity ordered from your regular product stock — no separate ingredient inventory to maintain. If an ingredient's stock can't be adjusted for some reason, Sarang doesn't silently lose the discrepancy: it raises a notification telling you which ingredient needs a manual recount, so your stock numbers never quietly drift.

Menu items with no recipe configured simply don't deduct any ingredient stock when sold — recipes are entirely optional per item.

## Reports

Open **Reports → Dish-Wise Contribution Margin** to see, per dish sold in a date range, its revenue minus its recipe cost — a bar chart plus a full table, sorted so your best-margin dishes sit at the top. This is a different question from **Reports → Food Cost Report**: Food Cost totals what you actually spent on ingredients this period, while Contribution Margin answers "which dishes are actually earning their keep," using each dish's own recipe formula rather than the aggregate spend. A combo or thali's margin correctly reflects the recipes of the real dishes inside it, and a menu item with no recipe configured simply shows 0 ingredient cost — an honest "no data," not a guess.

Open **Reports → Table Turnover by Hour** to see a day-of-week × hour-of-day heatmap of your dine-in table orders — the darker a cell, the busier your restaurant genuinely was during that hour, on that day of the week, across the date range. Only orders actually started from a table (via **Start Order** on Restaurant Tables) count here; a counter or takeaway sale with no table attached isn't part of a "table turnover" question and is correctly left out. Use it to see your real rush hours at a glance, not a guess based on memory — useful for scheduling staff shifts around when the floor is actually busiest.

Open **Reports → Recipe-vs-Actual Waste Variance** to compare, per ingredient, what your recipes say should have been used against what was actually drawn down from stock over a date range — a bar chart plus a full table, with the biggest gaps first. An ingredient running consistently higher than its recipes imply is a real signal worth a look — over-portioning, spillage, or a recipe that's drifted out of date — while an ingredient running lower can mean the opposite. This is genuinely different from both reports above it: Food Cost and Contribution Margin each show one side of the story (actual spend, or recipe-implied cost); this is the only report that puts the two sides of the SAME ingredient side by side.

Open **Reports → Orders by Channel** to see, over a date range, how many orders — and how much revenue — came from **Dine-in** (any order started from a table) versus **Takeaway**, **Zomato**, **Swiggy**, and **Other App** (however each table-less sale was tagged at billing time, see Kitchen Order Tickets above) — a pie chart plus a full table, one row per channel. A table-less sale nobody bothered to tag still counts, under Takeaway, so nothing silently falls out of the total. Use it to see at a glance how much of your business is walk-in dine-in versus counter pickup versus each delivery app, without having to dig through individual invoices.

## QR-code table ordering (opt-in)

Restaurant Tables also has a **QR Table Ordering** toggle, off by default. Turn it on and Sarang starts a small local server on your own WiFi network (no internet needed) so customers can scan a table's printed QR code, browse the menu, and submit an order request from their phone. Nothing becomes a real bill automatically — every incoming order shows up under **Incoming Orders** on the Kitchen Order Tickets screen, where staff explicitly **Accept** (sends it to the kitchen as a KOT, same as any other round on that table — no payment method to pick yet, that only happens later at Checkout, see Tables above) or **Reject** it. Each table's QR code can be generated and printed from its card on the Restaurant Tables screen, and the same menu page has a **Checkout** button of its own that a customer can tap to flag the table as ready to be billed, without it charging anything by itself.

### WiFi-join QR (combo with the order QR)

Since a customer's phone needs to be on your restaurant's WiFi to reach the order page at all, the **WiFi Network** card (shown once QR Table Ordering is on) lets you save your guest network's name and password once. After that, every table's QR code shows — and prints — a second QR code above the order QR: scan it to join the WiFi automatically, then scan the order QR right below it to browse the menu and order. No typing a password, no separate WiFi sign next to the table.

This is entirely optional — leave the WiFi Network card unconfigured and table QR codes work exactly as before (order QR only). Editing the network later (e.g. after changing your router's password) is a simple re-save; leaving the password field blank while updating just the network name keeps the existing password rather than clearing it. Marking the network as **open** (no password) skips the password field entirely — useful if your guest WiFi has no password of its own.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters. If you also turn on Logistics & Supply Chain in **Settings → Additional Business Features**, you get Fleet, Carriers, Shipments, GRN, Delivery Challan, Freight Ledger, and Logistics Analytics too — but this isn't on by default for a restaurant, since most restaurants don't run their own delivery fleet or receive formal supplier shipments.
