# Bakery / Sweet Shop / Catering

## What's different about this business type

A bakery sells fast-moving, short-shelf-life goods made from recipes (flour, sugar, butter deducted per cake sold), takes custom orders for cakes booked in advance, and often handles catering orders for events — 50 samosas and 20 cupcakes for a party, matched against the catalog and billed in one shot. Bakery combines Restaurant's recipe/ingredient tracking (without a dine-in table/KOT flow — a counter sale isn't a ticket), Pharmacy's batch/expiry tracking for short shelf life, and Stationery's bulk-list-order mechanic reused verbatim for catering.

## Recipe-Based Ingredient Deduction

Set up a Recipe on any baked-good Product (Product → Recipe) the same way a Restaurant dish would — list each ingredient and how much of it goes into one unit. Because a bakery counter sale has no kitchen-ticket flow, ingredient stock is deducted automatically the moment the sale is billed, not on a separate "order complete" step.

## Custom Orders

Open **Custom Orders** in the sidebar to book a custom cake or made-to-order treat: pick the customer, add each item with its quantity and price, and optionally capture the customization for a line — flavor, size, message, or design. Set an advance amount and how it was collected; the advance can't exceed the order's total.

When the order is ready, **Generate Invoice** on the order — this creates the real invoice from the order's own items and automatically records the already-collected advance as a real payment against it.

## Catering Bulk Orders

Open **Bulk-List Orders** (the same screen Stationery uses for school supply lists) to handle a catering order: stage each line as free text ("50 samosas", "20 cupcakes"), match each to a real catalog product, and bill the whole order in one shot once every line is matched.

## Catering Events

Open **Catering Events** in the sidebar for a full event booking — a wedding or large function, not a same-day bulk order. Pick the customer, the event's start (and end, for multi-day events) date, venue address, and attendee count, then set a **price per plate** as the initial quote. Add the event's menu (real catalog products with quantity and price), a meals-and-snacks count for each day of service, and staffing with its own per-role cost — cook, server, cleaner, or other, each with its own worker count and rate per worker.

Once the price is actually negotiated, use **Record Final Price** to capture the agreed total — kept separate from the original per-plate quote, so the negotiated discount is always visible rather than silently overwritten. **Generate Invoice** on the event bills at the final negotiated price if one was recorded, or the original quote otherwise, as a single Catering Service line, and records the advance already collected as a real payment against it.

## Reports

Alongside the standard Sales, Inventory, and Financial reports, Bakery gets:

- **Shelf-Life / Wastage** — stock written off as expired (use the **Expiry** reason when adjusting stock for expired goods), by product and value — the same report Grocery uses for perishables.
- **Recipe Margin** — the Food Cost and Dish Contribution Margin reports (from Restaurant's ingredient tracking) work here unchanged, since a bakery's ingredient deductions are recorded exactly the same way.
- **Pre-Order Production Sheet** — pick a date, and see every custom order due that day plus typical walk-in demand for that day of the week, consolidated into what to bake and exactly how much of each ingredient you'll need.

## Language

Bakery is not one of Sarang's service-business templates — it's a product-category business type, so it is **not** language-locked. The core interface, including the Custom Orders screen, is available in all 13 supported languages.
