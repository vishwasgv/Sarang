# Guide: Products, Categories and Stock

How to set up what you sell, keep stock right, and find out why a number is what it is.

## 1. Categories first (2 minutes, saves hours)

Categories group products for filtering and reports (for example *Bulbs*, *Switches*, *Wire*).

- **Inventory → Products → Category button** opens **Manage Categories**: add, rename, add a sub-category, or archive.
- **Quick-add while creating a product**: in the product form, pick **+ Create new category…**, type the name (and a parent if it is a sub-category) and it is created and selected immediately.

## 2. Add a product

**Inventory → Products → Add Product.**

| Field | What to enter |
|---|---|
| Product Name | What you and your customers call it |
| SKU / Barcode | Your own code, or scan the manufacturer's barcode |
| HSN Code | The goods classification code your accountant gives you (services use SAC) |
| Product Type | **Standard** (stock is counted) or **Service** (no stock, for example labour) |
| Unit | PCS, KG, L, M, BOX and so on |
| Cost Price | What you pay per unit, **before tax** (the cost of stock never includes purchase tax) |
| Selling Price | What you charge per unit. Before tax by default; including tax if you turn on **Prices include tax** |
| MRP | The printed maximum price, if any (shown struck through next to your price) |
| Tax Rate % | The GST rate for this product. Type it, or click a rate from **Settings → Tax Configuration** |
| Reorder Level / Quantity | The stock level that raises a low-stock alert, and how much you usually order |
| Opening Quantity | Stock you already have when you add the product |

**Prices are before tax unless you say otherwise.** By default Sarang adds tax on top when you sell or buy: selling price 100 with 18 percent tax sells at 118. If your shelf price already includes tax, turn on **Prices include tax** (Settings, or the switch on each document) and Sarang works the tax back out, so you do not have to divide by hand. See *Guide: Tax and GST*.

The tax rate you set here fills in automatically on invoices, quotations, sales orders, purchase orders, supplier bills and debit notes when you pick the product. You can still change it on a single line.

Variants (size and colour), weight-based selling, batches with expiry, serial or IMEI numbers, and kits (several products sold as one) are turned on by your business type or in **Settings → Additional Business Features**.

## 3. Get stock in

Stock goes **up** only when one of these happens:

1. **Receive Stock** on an approved Purchase Order.
2. A **GRN** with the line linked to a product is **Posted**.
3. **Opening Quantity** when you first create the product.
4. A **stock adjustment** (below).
5. A **Sales Return** takes goods back, or a **production run** finishes (manufacturers).

A **Supplier Bill** alone never adds stock. See *Guide: Buying From Suppliers*.

## 4. Get stock out

Stock goes **down** when you confirm a sale in Billing (or a Sales Order is invoiced), when a **Debit Note** sends goods back, when goods are used in production, or when you adjust it down.

Sarang will not let you sell more than you have. If a sale is blocked with *Insufficient stock*, either receive the purchase first or correct the stock count with a reason. If you truly need to sell before goods are booked in, turn on negative stock in **Settings → Business Features → Stock rules**; the quantity then shows below zero until you receive the goods.

## 5. Check and correct stock

- **Inventory** lists every product with current quantity, reorder level, average cost and stock value. The **Low Stock** tab shows what needs ordering.
- **Adjust stock**: click the adjust icon on a row and enter the **new quantity** (not the difference). Give a reason (damage, count, opening balance). When you increase stock you can record the cost of the added units.
- **Movements** (button on Inventory) is a read-only history of every change: Stock Added, Sale, PO Received, Adjustment, Sale Return, and more. Use it to answer "why is this number what it is?".
- **Counting stock**: **Inventory → Stock Counts → New count**. Sarang takes a snapshot of what it thinks you have for every item; you type what you actually counted, and it shows the difference and its value. Nothing changes until you press **Post**, which turns each difference into a stock adjustment (reason: stock count) at your main location. Only one count can be open at a time. Items with batches, serial numbers or expiry are counted by total quantity only. If posting is interrupted, the count stays open and the lines already posted stay posted: press Post again to finish the rest. **Reports → Stock Count Variances** shows what was missing or extra.
- **Stock Locations**: keep separate stock for shop, godown or van, and move stock between them.
- **Bin Locations**: **Inventory → Bin Locations** records which shelf, rack or bin (for example A-3-2) each item sits on within a location, so anyone can find it. It is a label typed by hand: one bin per item per location, and it appears on this screen only (not yet on reports or printed lists).
- **Stock Journal**: **Inventory → Stock Journal** records goods that change form, such as breaking a carton into packs: choose what goes out and what comes in and save them together. The value going out is spread over the items coming in by quantity. It cannot be edited or reversed once saved: correct a mistake with an opposite entry.
- **Promised on orders**: **Inventory** and the Stock Summary report show, next to each item, how much is promised on open Sales Orders. It is a reminder, not a block: nothing stops you selling promised stock.

## 6. Reorder before you run out

- Set a **Reorder Level** on each product.
- Watch the low-stock tiles on the **Dashboard** and the bell alerts. A low-stock alert opens **Inventory** when you click it.
- On the **Inventory** screen, **Generate Reorder POs** creates draft purchase orders for everything under its reorder level, using each product's default supplier (set a default supplier on the product first).

## 7. What is my stock worth?

**Inventory** shows the value of each product (quantity x average cost). **Reports → Stock Summary**, **Stock Ledger** (every movement with opening and closing), **Inventory Ageing** and the stock-by-location and transfer reports show valuation, movement and how long items have sat. Valuation follows the method you use (average, FIFO and others where enabled) and each report says it is as at today. Costs from freight or duty entered as **landed cost** on a purchase raise the cost of those items.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Typing a new item on a GRN without linking it | Stock does not go up | Use **+ Create product and link** on the line before posting |
| Entering a tax-inclusive selling price while Prices include tax is off | Customers are charged tax twice | Turn on **Prices include tax**, or enter the before-tax price |
| Tax rate left at 0 | Tax is missing on documents | Set the rate on the product |
| Adjusting stock by the difference | Wrong quantity | Enter the **new total** quantity |
| Deleting a product with history | Not allowed | Archive it instead |


**Printing shelf and shipment labels.** **Inventory → Print Labels** prints item labels; a shipment has **Print labels** and **Track**, which shows its own timeline of dispatches, delays and delivery that you update yourself (there is no live courier feed).
