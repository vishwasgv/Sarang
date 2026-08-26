# Manufacturing

Manufacturing turns Sarang from a buy-and-sell system into a make-and-sell one: you track raw materials coming in, define what a finished product actually needs to be made, run production orders that consume materials and produce stock, then dispatch the finished goods out to customers. Manufacturing also gets the full Logistics & Supply Chain module set (Fleet, Carriers, GRN, Freight) by default, since receiving formal supplier consignments of raw material is a normal part of running a factory floor.

## 1. Raw Materials

**Raw Materials** is your ingredient/component inventory, separate from your regular product stock. Each material has a name, a unit (kg, litre, piece, box, and similar), a reorder level, and a unit cost. The list flags anything below its reorder level and totals your current stock value.

Stock only moves through **Adjust Stock**, which records one of three movement types — Purchase (stock in), Return (stock in), or Adjust To (a manual correction) — plus a fourth type, Consumed, that the system creates automatically whenever a production order starts (see below). Every movement is logged with a running balance in **Movement History**, so you can see exactly why a material's stock is what it is.

## 2. Bill of Materials (BOM)

A BOM defines what a finished product actually needs: pick the product, set an output quantity per batch, and list what it consumes — either a raw material, or **another manufactured product as a sub-assembly** (toggle the row's type), with a quantity needed and an optional wastage percentage. Wastage inflates the effective quantity consumed (e.g. 5% wastage on a needed 10 kg means 10.5 kg is actually planned for consumption). Building a multi-level product — say a Car that needs an Engine, which is itself manufactured from raw Steel — Sarang checks for circular references (a component that would eventually need itself) and blocks saving one. Sarang totals the material cost per batch from each ingredient's current unit cost — this is the cost basis a production order will use later.

Only one BOM per product is allowed; editing an existing BOM lets you change quantities, wastage, and component rows but not which product it's for.

Raw materials received in distinct lots (a delivery today may cost differently than last month's) can be tracked as **material batches** from Raw Materials — receive a lot with its own quantity, and a production order automatically draws from the oldest lot first (FIFO), so you always know exactly which lot went into which production run.

## 3. Production Orders

This is the core manufacturing workflow, and it moves through four states:

- **Draft** — you pick a product with a BOM and a planned quantity; Sarang calculates exactly how much of each raw material that plan needs.
- **In Progress** — starting an order checks that every required raw material has enough stock; if anything is short, it tells you exactly what and by how much, and refuses to start. Once started, the raw materials are deducted immediately (recorded as a "Consumed" movement against each material) — this happens at start, not at completion.
- **Completed** — you enter the actual produced quantity, a **scrap/reject quantity** (units that consumed material and labor but yielded nothing sellable), and a labor cost for the run. Sarang adds the produced quantity to the finished product's stock and recalculates its average cost from material cost plus labor cost (plus overhead, below), divided across the produced units only — the scrapped units' cost is absorbed into the good units' cost, since they still consumed real resources.

For more accurate job costing, add itemized **Labor Entries** instead of a single flat labor cost — from a production order, **+ Add Labor Entry** lets you record each worker's name, hours worked, and rate per hour. Once any labor entries exist for an order, their sum replaces the flat labor cost automatically when the order completes; with no entries at all, the flat labor cost you enter at completion is still used exactly as before, so this is entirely opt-in. Your business can also set an **overhead allocation** rate in Settings (per labor hour, or per unit produced) to fold a share of fixed running costs — rent, power, equipment — into every completed order's cost automatically, on top of material and labor.
- **Cancelled** — available from Draft or In Progress, with an optional reason. Cancelling an order that already consumed raw materials returns them to stock.

Each production order can also carry an optional checklist of **work order steps** (e.g. "Mixing", "Baking", "Packing") that you tick off one by one as production actually happens on the floor. Mark a step as a **QC checkpoint** and Sarang requires a real Pass/Fail result before it can be checked off — a quality gate can't be silently skipped with a plain tick. At the same prompt, you can also record how many units were **inspected** and how many were **rejected** at that specific stage — independent of the overall Pass/Fail, since a batch can pass overall with a handful of units still rejected at that one checkpoint. This is what feeds the Rejection Rate Trend report below.

Any step can also have **downtime** logged against it — tap **+ Downtime** on a step while the order is In Progress, give a reason (machine breakdown, material shortage, waiting on labour, or whatever actually happened) and how many minutes were lost. Nothing else changes because of it — a pair of tried-on shoes was never a stock movement, and neither is a stopped machine — it's purely a record of where real time is being lost, visible right on the step and totalled up whenever you ask the AI Assistant "how much downtime did we have?"

Above the order list, Sarang also flags your **slowest stage** automatically — computed from real timestamps on completed work-order steps across all your completed orders, no extra logging required. If one stage is consistently eating more time than the others, you'll see a banner naming it, its average duration, and what share of total lead time it accounts for — the actual bottleneck holding up delivery, not just a guess.

## 4. Dispatch Tracking

Once a product is finished and in stock, **Dispatch** records it going out the door: pick the product, a quantity, and optionally a customer and destination. A dispatch record starts as **Ready**, moves to **Dispatched** (this is the point Sarang actually deducts the quantity from finished-goods inventory — not at creation), and finally **Delivered**. Creating a dispatch record checks that enough finished stock exists before letting you proceed.

## 5. Finished Goods

**Finished Goods** lists every product that has a BOM defined for it — in other words, everything you actually manufacture rather than just resell. For each one you can see current stock, selling price, and pull up its full **production history** (every production order that has ever produced it, planned vs. produced quantity, and status).

## 6. Vendor Management

This screen is your raw-material supplier directory: every active supplier that has at least one raw material linked to them, with contact details, outstanding balance, and a drill-down into exactly which materials you buy from them (with each material's current stock, low-stock flag, and unit cost). It reuses the same Supplier records as the rest of Sarang — there's no separate "manufacturing vendor" list to maintain.

## 7. Production Analytics

A dashboard of your manufacturing activity: order counts by status (Draft / In Progress / Completed / Cancelled), your overall **yield rate** (total produced ÷ total planned across completed orders), total material cost spent, and a recent-completed-orders table showing per-order yield percentage and cost-per-unit — useful for spotting which products consistently produce less than planned or cost more than expected.

## 8. True Landed Cost & Rejection Rate Reports

Open **Reports → True Landed Cost per Finished Unit** to see, for each product, material, labour, and overhead cost per unit side by side on one chart — the real cost of what you made, not just the raw materials that went into it. This is deliberately not the same number as the material cost shown when you build a BOM: it uses each completed order's own actual recorded labour and overhead, and backs the material share out of the exact cost that was already used to value that batch's stock, so it reflects real prices at the time you actually produced it, not whatever a raw material happens to cost today.

**Reports → Rejection Rate Trend** turns the per-stage inspection counts from Work Order Steps into a real quality picture: a month-by-month trend line of your overall rejection rate, plus a breakdown by stage so you can see which one is actually losing you good units — not just whether the final batch passed or failed. Ask the AI Assistant "what's our rejection rate?" or "what's our landed cost per unit?" for either as a quick spoken answer.
