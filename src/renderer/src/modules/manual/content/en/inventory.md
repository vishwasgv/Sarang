# Inventory

## Adding and editing products

Open **Products** from the sidebar to see your full product list, filterable by category. Click **Add Product** to create one, or the edit icon on any row to change it. A product's core fields are:

- **Product Name**, **SKU**, **Barcode**, **HSN Code**, and a short **Description**.
- **Product Type** — Standard (a physical item with tracked stock) or Service (no stock to track, e.g. a labour charge).
- **Unit** — choose from a fixed list (PCS, KG, G, L, ML, M, CM, SQFT, SQM, BOX, DOZEN, PACKET, PAIR, SET, BOTTLE, BAG, ROLL, HOUR, SERVICE).
- **Cost Price**, **Selling Price**, and **Tax Rate** — the tax rate can be typed freely, or applied with one click from any rate configured in **Settings → Tax Configuration**.
- **Reorder Level** and **Reorder Quantity** — the stock threshold that triggers a low-stock warning, and how much you'd typically reorder.
- **Opening Quantity** — the stock count to start with when the product is first created.
- An optional **product image**.

**Categories** are managed from the **Category** button on the Products screen, letting you group products for filtering and reporting.

Some product types are opt-in and only shown when the matching feature is turned on for your business (from **Settings → Additional Business Features** or your business type's own template): sell-by-weight/loose billing, size/color variants, rentable items, and jewellery metal pricing. These are opt-in per product — turning on a feature doesn't force every product into that mode. Batch/expiry tracking, serial/IMEI tracking, and other business-type-specific stock behaviors are covered in the relevant business-type chapter, not here.

## Stock levels and movements

**Inventory** (`/inventory`) lists every product's current stock, reorder level, average cost, and stock value, with a running count of low-stock and out-of-stock items shown as alert badges at the top. Switch between **All** and **Low Stock** using the tabs.

To manually correct a stock count — after a physical count, damage, or an opening balance — click the adjust-stock icon on a row. Enter the new quantity (not the difference); the screen shows you how much will be added or removed before you save, and requires a reason. If you're increasing stock, you can optionally record the cost per unit for that addition, which feeds into the product's average cost used for valuation.

Every change to stock — a sale, a manual adjustment, a purchase order received, a return, or a production run — is recorded as an immutable **movement**. **Inventory Movements** (`/inventory/movements`, reached via the **Movements** button) is a read-only ledger of every one of these, filterable by type (Stock Added, Sale, PO Received, Adjustment, Sale Return, Return Received, Dispatched, Produced) and searchable, so you can always trace exactly why a product's stock is what it is.

## Purchase Orders

**Purchase Orders** (`/purchase-orders`) track what you've ordered from suppliers. Create one with **New PO**: pick a supplier, add line items (searched by product name or SKU) with quantity, unit cost, and tax rate, and an optional expected delivery date.

A purchase order moves through a fixed lifecycle:

1. **Draft** — still editable.
2. **Approve** it to lock it against further changes.
3. **Receive Stock** — this is the step that actually adds the ordered quantities into your inventory and records a PURCHASE movement for each item. Once received, the PO shows each item's resulting stock level alongside the order line.
4. A Draft or Approved PO can instead be **cancelled**, with a reason.

## Low-stock visibility

Low and out-of-stock counts appear in three places that all stay in sync: the alert badges at the top of the Inventory screen, the low-stock and out-of-stock tiles on the Dashboard, and the low-stock filter on the Products/Inventory screens. Setting a sensible reorder level on each product (the default is 5) is what makes these alerts useful — a product with no reorder level set effectively never triggers a low-stock warning.
