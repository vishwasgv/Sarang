# Clothing

Choosing **Clothing** as your business type turns on **size/colour variant tracking**, **Returns**, and the shared **Logistics** module set. Everything else — Billing, Products, Customers, Inventory, Reports — works exactly as described in those chapters; this chapter covers what's specific to a clothing store.

## Variant tracking (size & colour)

A clothing item usually isn't one single stock number — "Men's T-Shirt" might exist in five sizes and four colours, each with its own stock count. From **Products**, tap the layers icon on any product to open **Manage Variants**. Add a row per size/colour combination you actually stock (size and colour fields suggest common clothing sizes as you type — XS through 3XL — but you can type anything), each with its own optional SKU, an additional price on top of the base product price if that variant costs more (e.g. a plus size), and its own stock quantity. The screen shows a running total of variants and combined stock across all of them.

Product records for a Clothing business also get an optional **Gender** field (Men's/Women's/Unisex) and a free-text **Season / Collection** field (e.g. "Summer 2026", "Diwali Collection") to help you organize your catalog.

Stocking a lot of combinations at once? Use **Generate Size × Colour Matrix** at the bottom of Manage Variants — type your sizes and colours as comma-separated lists (e.g. "S, M, L" and "Black, White") and Sarang creates every combination as a new row in one go, skipping any pair you've already added by hand.

Each variant row has its own **barcode** — generate one per row, or use **Generate Missing Barcodes** to fill in every variant that doesn't have one yet. When printing labels, a variant-tracked product opens a picker so the label carries that exact variant's own barcode and price, not the parent product's.

Ready to reorder a product but not sure how to split it across sizes? Open **Suggested Reorder Split** at the bottom of Manage Variants, enter a total quantity (or leave it blank to use the product's own configured reorder quantity), and Sarang weights the split toward whichever sizes and colours have actually been selling over the last 90 days — instead of splitting evenly. It's the fix for the classic "sold out of M and L three weeks before S and XL, but reordered them all equally anyway" problem. This is a suggestion only, not a live order — you still place the real Purchase Order yourself, informed by the split.

## Selling a variant

In **Billing**, adding a product that has variants configured doesn't add it to the cart directly — it opens a picker so you choose the exact size/colour combination being sold, and that specific variant's stock and price (base price + its additional price, if any) is what actually goes into the cart. This keeps your per-size/colour stock counts accurate rather than just decrementing one shared number for the whole product.

## Season/Collection Sell-Through Report

If you tag your products with a **Season / Collection**, open **Reports → Season/Collection Sell-Through** to see, month by month, what share of each collection's sold-plus-in-stock units actually sold — a fast way to spot which collection is moving and which is quietly piling up on the shelf. The chart shows each collection as its own bar per month, with an overall-average trend line running through it; the number is compared against your current stock on hand for every month shown, so read it as a running trend rather than each month's own exact historical snapshot. Products with no season set are left out of this report entirely — tag the ones you want to track.

## Size × Style Heatmap Report

Open **Reports → Size × Style Heatmap** to see a grid of exactly which size/product combinations are actually selling — every product ("style") down the side, every size across the top, each cell shaded by how many units of that exact combination sold in the date range you pick. Darker cells mean more units moved; a blank cell means that size/style pairing didn't sell at all. It's built for spotting patterns a plain sales list would bury — a style that only moves in M and L, or a size that never sells no matter the style. The grid shows your top 15 best-selling styles by volume, so it stays readable even on a large catalog.

## Returns

Clothing also gets the standard **Returns** screen — search a past invoice by number, select which items and quantities to return (capped at what's actually still returnable, accounting for anything already returned earlier), give a reason, and submit. See the *Returns* section of the Retail chapter for the full behavior — it works identically here.

## Logistics & Supply Chain

Because Clothing's default template includes the Logistics modules, you also get **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, and **Logistics Analytics** for tracking your own delivery vehicles and supplier shipments — see the Logistics screens under those names in the sidebar.

## What's shared with every business

Billing, invoicing, payments, Customers, Products, Reports, Backup, and Users & Permissions all work exactly as described in their own chapters.
