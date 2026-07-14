# Restaurant

Choosing **Restaurant** as your business type during setup turns on four things beyond the universal features every business gets: **Tables**, **Kitchen Order Tickets (KOT)**, **Recipes**, and ingredient stock tracking. Billing, Customers, Inventory, and Reports all work the same way described in their own chapters — this chapter only covers what's specific to running a restaurant.

## Tables

Open **Restaurant Tables** from the sidebar to see every table you've configured, each shown as a card with its current status: **Free**, **Busy**, or **Rsv** (Reserved). Add a table with a table number (e.g. "T1") and an optional display name. Tap a status button on a table's card to change it — a table can't be deleted while it has an active kitchen ticket.

**End of Day** is a button on this screen: it marks every occupied table available again and shows a one-line closing summary (KOTs served and today's revenue) so you can close out the dining room at the end of a shift.

## Kitchen Order Tickets (KOT)

A KOT is the kitchen's copy of an order. After ringing up an order in **Billing**, open the invoice and tap **Send to Kitchen** to create a KOT for it. From **Kitchen Order Tickets** in the sidebar, kitchen staff see every ticket grouped by status — Pending, In Progress, Done, Cancelled — with its items and quantities, and move each one forward with a single tap (**Start Cooking** → **Mark Done**), or **Cancel** it. Each ticket can also be printed directly to your kitchen printer.

Marking a KOT **Done** is what triggers ingredient stock deduction (see below) and frees up the table it belonged to, once no other active ticket is using that table.

## Recipes and ingredient tracking

Open **Recipes** to link a menu item (e.g. "Masala Chai") to the raw ingredients it consumes and how much of each — search for the menu product, name the recipe, then add ingredient rows (each ingredient can only appear once per recipe; combine quantities instead of adding a duplicate row). Every recipe's ingredient list is shown expanded in the list view.

Once a recipe exists for a menu item, completing its KOT (marking it Done) automatically deducts the recipe's ingredient quantities × the quantity ordered from your regular product stock — no separate ingredient inventory to maintain. If an ingredient's stock can't be adjusted for some reason, Sarang doesn't silently lose the discrepancy: it raises a notification telling you which ingredient needs a manual recount, so your stock numbers never quietly drift.

Menu items with no recipe configured simply don't deduct any ingredient stock when sold — recipes are entirely optional per item.

## QR-code table ordering (opt-in)

Restaurant Tables also has a **QR Table Ordering** toggle, off by default. Turn it on and Sarang starts a small local server on your own WiFi network (no internet needed) so customers can scan a table's printed QR code, browse the menu, and submit an order request from their phone. Nothing becomes a real bill automatically — every incoming order shows up under **Incoming Orders** on the Kitchen Order Tickets screen, where staff explicitly **Accept** (choosing a payment method, which creates the invoice and KOT together) or **Reject** it. Each table's QR code can be generated and printed from its card on the Restaurant Tables screen.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters. If you also turn on Logistics & Supply Chain in **Settings → Additional Business Features**, you get Fleet, Carriers, Shipments, GRN, Delivery Challan, Freight Ledger, and Logistics Analytics too — but this isn't on by default for a restaurant, since most restaurants don't run their own delivery fleet or receive formal supplier shipments.
