# Clothing

Choosing **Clothing** as your business type turns on **size/colour variant tracking**, **Returns**, and the shared **Logistics** module set. Everything else — Billing, Products, Customers, Inventory, Reports — works exactly as described in those chapters; this chapter covers what's specific to a clothing store.

## Variant tracking (size & colour)

A clothing item usually isn't one single stock number — "Men's T-Shirt" might exist in five sizes and four colours, each with its own stock count. From **Products**, tap the layers icon on any product to open **Manage Variants**. Add a row per size/colour combination you actually stock (size and colour fields suggest common clothing sizes as you type — XS through 3XL — but you can type anything), each with its own optional SKU, an additional price on top of the base product price if that variant costs more (e.g. a plus size), and its own stock quantity. The screen shows a running total of variants and combined stock across all of them.

Product records for a Clothing business also get an optional **Gender** field (Men's/Women's/Unisex) to help you organize your catalog.

Stocking a lot of combinations at once? Use **Generate Size × Colour Matrix** at the bottom of Manage Variants — type your sizes and colours as comma-separated lists (e.g. "S, M, L" and "Black, White") and Sarang creates every combination as a new row in one go, skipping any pair you've already added by hand.

Each variant row has its own **barcode** — generate one per row, or use **Generate Missing Barcodes** to fill in every variant that doesn't have one yet. When printing labels, a variant-tracked product opens a picker so the label carries that exact variant's own barcode and price, not the parent product's.

## Selling a variant

In **Billing**, adding a product that has variants configured doesn't add it to the cart directly — it opens a picker so you choose the exact size/colour combination being sold, and that specific variant's stock and price (base price + its additional price, if any) is what actually goes into the cart. This keeps your per-size/colour stock counts accurate rather than just decrementing one shared number for the whole product.

## Returns

Clothing also gets the standard **Returns** screen — search a past invoice by number, select which items and quantities to return (capped at what's actually still returnable, accounting for anything already returned earlier), give a reason, and submit. See the *Returns* section of the Retail chapter for the full behavior — it works identically here.

## Logistics & Supply Chain

Because Clothing's default template includes the Logistics modules, you also get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters.
