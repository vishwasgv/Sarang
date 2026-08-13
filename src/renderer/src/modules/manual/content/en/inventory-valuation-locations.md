# Inventory Valuation & Multi-Location Stock

## Valuation Method

Every product now carries a **Valuation Method**, set on the product form: **Weighted Average** (the default — the cost you see is a running average across every purchase), **FIFO** (First In, First Out — the cost reflects your oldest purchase layers still on hand), or **Standard Cost** (a fixed cost you set yourself, which doesn't move with purchase prices). Whichever method a product uses, that's the cost figure Sarang uses everywhere cost matters for that product — margin on the Dashboard, the Profit & Loss report, the Food Cost report, and reorder-draft suggestions all read the same resolved cost, so they never disagree with each other.

Changing a product's valuation method doesn't rewrite its purchase history — it only changes which figure Sarang reads going forward.

## Locations & Stock Transfer

**Locations** (`/locations`) is for businesses that store stock in more than one place — a warehouse plus a retail counter, or two branches. Every business starts with a single default "Main" location that all existing stock already belongs to, so nothing changes until you actually add a second one. Add a location with **New Location** (name and an optional address); the first location created is always the default, and a default location can't be deactivated since every stock movement that doesn't name a specific location goes there.

Once a second location exists, a **Transfer Stock** action appears: pick a product, a quantity, a source and destination location, and an optional reason. A transfer only moves stock between locations — it never changes how much you have in total, so it doesn't create a new inventory movement of the "stock added" or "stock removed" kind, just a location-to-location shift.

## Landed Cost

**Landed Cost** lets you fold extra purchase-side costs — freight, customs duty, handling, or anything else — into what a product actually cost you, instead of leaving them sitting as a separate, unattributed expense.

On a **Purchase Order**, add a landed cost from its detail screen: choose a type (Freight, Duty, Handling, or Other), an amount, and how to spread it across the order's lines — **by line value** (a line worth more of the order absorbs more of the cost) or **by quantity** (spread evenly per unit regardless of price). You can add or remove landed costs freely until the PO is first received; once receiving has started, they're locked in, since the cost history they feed into is never rewritten after the fact. On a **Bill**, landed costs are entered inline at creation time only, in an optional section — a Bill posts its cost history immediately with no separate "receive" step to add costs to later.

Either way, the landed cost is folded into the per-unit cost recorded for that purchase, which is exactly what your valuation method (above) then reads from.

## Composite Items (Kits)

A **Kit** is a product made of other products, sold and stocked as one item but priced and inventoried through its real components. Turn a product into a kit from its own form: tick **This is a Kit** and pick its components (each must be a real, in-stock Standard product — services and other kits can't be added as a component, since a kit's stock has to trace back to something that's actually sitting on a shelf).

When you sell a kit, the invoice still shows one line at the kit's own price — nothing changes for the customer or the cashier. Behind the scenes, Sarang checks that every component has enough stock before allowing the sale, then deducts each component's real quantity, so your component-level stock counts always stay accurate even though the kit itself was what got sold.

## Reorder-Level Auto-PO

Every product's **Reorder Level** already exists to trigger low-stock warnings (see the *Inventory* chapter); that same threshold now also drives **draft Purchase Order generation**. From the Inventory screen, generating reorder drafts groups every below-threshold product by its usual supplier and creates one Draft PO per supplier, pre-filled with a suggested reorder quantity and the product's current resolved cost — you still review and approve each one before it becomes real, nothing is sent to a supplier automatically.

## Floating Unit Conversion (GRN)

Some purchased goods don't convert to your selling unit at a perfectly fixed ratio — a "bag of rice" might nominally hold 25 kg, but the bag you actually receive weighs 24.6 kg. Turn on **Floating Unit Conversion** on a product (alongside its existing pack/weight selling setup) to capture this at the point of receiving: on a **GRN** (Goods Receipt Note), a **Purchase Unit Qty** field appears next to that line — enter how many bags you received, while the existing **Rcvd** field stays the real, measured quantity actually taken into stock. The two are allowed to differ; Sarang derives the true conversion factor for that specific receipt from the two numbers you entered, rather than assuming every bag was exactly 25 kg.
