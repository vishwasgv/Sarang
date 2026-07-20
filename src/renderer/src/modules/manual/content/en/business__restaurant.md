# Restaurant

Choosing **Restaurant** as your business type during setup turns on four things beyond the universal features every business gets: **Tables**, **Kitchen Order Tickets (KOT)**, **Recipes**, and ingredient stock tracking. Billing, Customers, Inventory, and Reports all work the same way described in their own chapters — this chapter only covers what's specific to running a restaurant.

## Tables

Open **Restaurant Tables** from the sidebar to see every table you've configured, each shown as a card with its current status: **Free**, **Busy**, or **Rsv** (Reserved). Add a table with a table number (e.g. "T1") and an optional display name. Tap a status button on a table's card to change it — a table can't be deleted while it has an active kitchen ticket. Assign a **waiter** to a table from its card so you always know who's serving it; clear the assignment any time.

**End of Day** is a button on this screen: it marks every occupied table available again and shows a one-line closing summary (KOTs served and today's revenue) so you can close out the dining room at the end of a shift.

## Tip / service charge and "86" items

On the Billing screen, use **Add Tip / Service Charge** to add a tip line to a bill without it being tied to any specific menu item or taxed as a product.

On the Products screen, toggle any menu item **86** (kitchen slang for "out of stock for today") to instantly hide it from the billing cart and the customer-facing QR menu, without deactivating the product itself — perfect for a dish that's sold out for the day but will be back on the menu tomorrow.

## Kitchen Order Tickets (KOT)

A KOT is the kitchen's copy of an order. After ringing up an order in **Billing**, open the invoice and tap **Send to Kitchen** to create a KOT for it. From **Kitchen Order Tickets** in the sidebar, kitchen staff see every ticket grouped by status — Pending, In Progress, Done, Cancelled — with its items and quantities, and move each one forward with a single tap (**Start Cooking** → **Mark Done**), or **Cancel** it. Each ticket can also be printed directly to your kitchen printer.

Marking a KOT **Done** is what triggers ingredient stock deduction (see below) and frees up the table it belonged to, once no other active ticket is using that table.

## Kitchen hardware options

Beyond the in-app Kitchen Order Tickets screen, Sarang offers three ways to get tickets in front of kitchen staff — all three can run at once (printing a paper ticket, showing a wall monitor, and letting a phone or tablet control it are not mutually exclusive). Set these up from **Settings → Appearance**, restaurant businesses only.

**Kitchen printer.** By default, printing a KOT goes to whatever your Windows default printer is. If your kitchen printer is a different physical device than your billing counter's receipt printer, pick it from the **Kitchen Printer** dropdown — every KOT print job goes straight there from then on, no print dialog, no manual picking. Leave it on "Use Windows default printer" if you only have one printer.

**Kitchen Display — second monitor.** Turns any second monitor plugged into the billing PC into a live, large-text KOT board (Pending / In Progress / Recently Done), operated with an ordinary mouse — no touchscreen required. Under **Kitchen Display — second monitor**, pick a detected display and tap **Open Kitchen Display**; it opens full-screen there and refreshes automatically. A few physical setup notes:
- The mouse just needs to reach the PC, not the screen — if the kitchen is more than a couple of metres from the billing PC, use a **wireless mouse** (its USB receiver plugs into the billing PC) rather than a wired one, since a wired mouse's cable won't reach.
- The monitor's video cable has the same distance problem, usually worse — a plain HDMI cable starts losing signal past roughly 10-15 metres. If your kitchen is a separate room or across the restaurant (say 10-30m, possibly through a wall), use an **HDMI-over-Ethernet extender kit** (a cheap sender/receiver pair connected by a standard network cable) rather than a single long HDMI cable.
- In Windows Display settings, make sure the second monitor is set to **Extend these displays**, not Duplicate — that's what lets your one mouse cursor move across onto it.
- If running a cable that far turns out to be impractical, use the phone/tablet/laptop option below instead — it needs no cabling at all.

**Kitchen Display — phone / tablet / laptop.** Lets any phone, tablet, or laptop connected to your shop's WiFi open a live KOT board in its own browser — no app to install, a tablet propped up in the kitchen works exactly the same way as a phone or laptop here. Turn it on under **Kitchen Display — phone / laptop**, then either read out the LAN address(es) shown or tap **Show QR code** and have the device scan it. This works entirely over your own WiFi, no internet required, and is completely separate from the customer-facing QR table ordering feature below (different server, different port, and a random access code that's only ever shown here in Settings — a customer who scans their table's ordering QR code has no way to reach the kitchen board). If access ever needs to be revoked (e.g. a phone with the link is lost), tap **Regenerate access code** — every previously shared link/QR code stops working immediately.

## Recipes and ingredient tracking

Open **Recipes** to link a menu item (e.g. "Masala Chai") to the raw ingredients it consumes and how much of each — search for the menu product, name the recipe, then add ingredient rows (each ingredient can only appear once per recipe; combine quantities instead of adding a duplicate row). Every recipe's ingredient list is shown expanded in the list view.

Once a recipe exists for a menu item, completing its KOT (marking it Done) automatically deducts the recipe's ingredient quantities × the quantity ordered from your regular product stock — no separate ingredient inventory to maintain. If an ingredient's stock can't be adjusted for some reason, Sarang doesn't silently lose the discrepancy: it raises a notification telling you which ingredient needs a manual recount, so your stock numbers never quietly drift.

Menu items with no recipe configured simply don't deduct any ingredient stock when sold — recipes are entirely optional per item.

## QR-code table ordering (opt-in)

Restaurant Tables also has a **QR Table Ordering** toggle, off by default. Turn it on and Sarang starts a small local server on your own WiFi network (no internet needed) so customers can scan a table's printed QR code, browse the menu, and submit an order request from their phone. Nothing becomes a real bill automatically — every incoming order shows up under **Incoming Orders** on the Kitchen Order Tickets screen, where staff explicitly **Accept** (choosing a payment method, which creates the invoice and KOT together) or **Reject** it. Each table's QR code can be generated and printed from its card on the Restaurant Tables screen.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters. If you also turn on Logistics & Supply Chain in **Settings → Additional Business Features**, you get Fleet, Carriers, Shipments, GRN, Delivery Challan, Freight Ledger, and Logistics Analytics too — but this isn't on by default for a restaurant, since most restaurants don't run their own delivery fleet or receive formal supplier shipments.
