# Manufacturing

Manufacturing turns Sarang from a buy-and-sell system into a make-and-sell one: you track raw materials coming in, define what a finished product actually needs to be made, run production orders that consume materials and produce stock, then dispatch the finished goods out to customers. Manufacturing also gets the full Logistics & Supply Chain module set (Fleet, Carriers, GRN, Freight) by default, since receiving formal supplier consignments of raw material is a normal part of running a factory floor.

## 1. Raw Materials

**Raw Materials** is your ingredient/component inventory, separate from your regular product stock. Each material has a name, a unit (kg, litre, piece, box, and similar), a reorder level, and a unit cost. The list flags anything below its reorder level and totals your current stock value.

Stock only moves through **Adjust Stock**, which records one of three movement types — Purchase (stock in), Return (stock in), or Adjust To (a manual correction) — plus a fourth type, Consumed, that the system creates automatically whenever a production order starts (see below). Every movement is logged with a running balance in **Movement History**, so you can see exactly why a material's stock is what it is.

## 2. Bill of Materials (BOM)

A BOM defines what a finished product actually needs: pick the product, set an output quantity per batch, and list the raw materials it consumes with a quantity needed and an optional wastage percentage. Wastage inflates the effective quantity consumed (e.g. 5% wastage on a needed 10 kg means 10.5 kg is actually planned for consumption). Sarang totals the material cost per batch from each ingredient's current unit cost — this is the cost basis a production order will use later.

Only one BOM per product is allowed; editing an existing BOM lets you change quantities and wastage but not which product it's for.

## 3. Production Orders

This is the core manufacturing workflow, and it moves through four states:

- **Draft** — you pick a product with a BOM and a planned quantity; Sarang calculates exactly how much of each raw material that plan needs.
- **In Progress** — starting an order checks that every required raw material has enough stock; if anything is short, it tells you exactly what and by how much, and refuses to start. Once started, the raw materials are deducted immediately (recorded as a "Consumed" movement against each material) — this happens at start, not at completion.
- **Completed** — you enter the actual produced quantity (it doesn't have to match the plan). Sarang adds that quantity to the finished product's stock and recalculates its average cost using the same weighted-average formula every other stock-in path in Sarang uses, so a manufactured batch's cost basis flows correctly into your inventory valuation and profit reports.
- **Cancelled** — available from Draft or In Progress, with an optional reason. Cancelling an order that already consumed raw materials returns them to stock.

Each production order can also carry an optional checklist of **work order steps** (e.g. "Mixing", "Baking", "Packing") that you tick off one by one as production actually happens on the floor — this is separate from the material/quantity tracking and purely for following the physical process.

## 4. Dispatch Tracking

Once a product is finished and in stock, **Dispatch** records it going out the door: pick the product, a quantity, and optionally a customer and destination. A dispatch record starts as **Ready**, moves to **Dispatched** (this is the point Sarang actually deducts the quantity from finished-goods inventory — not at creation), and finally **Delivered**. Creating a dispatch record checks that enough finished stock exists before letting you proceed.

## 5. Finished Goods

**Finished Goods** lists every product that has a BOM defined for it — in other words, everything you actually manufacture rather than just resell. For each one you can see current stock, selling price, and pull up its full **production history** (every production order that has ever produced it, planned vs. produced quantity, and status).

## 6. Vendor Management

This screen is your raw-material supplier directory: every active supplier that has at least one raw material linked to them, with contact details, outstanding balance, and a drill-down into exactly which materials you buy from them (with each material's current stock, low-stock flag, and unit cost). It reuses the same Supplier records as the rest of Sarang — there's no separate "manufacturing vendor" list to maintain.

## 7. Production Analytics

A dashboard of your manufacturing activity: order counts by status (Draft / In Progress / Completed / Cancelled), your overall **yield rate** (total produced ÷ total planned across completed orders), total material cost spent, and a recent-completed-orders table showing per-order yield percentage and cost-per-unit — useful for spotting which products consistently produce less than planned or cost more than expected.
