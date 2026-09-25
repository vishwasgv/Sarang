# Guide: Buying From Suppliers, From Order to Payment

The full buying cycle, with what each step does to your stock and your money. Read the table first: it prevents the most common confusion.

```
Purchase Order  ->  Receive Stock / GRN  ->  Supplier Bill  ->  Supplier Payment  ->  (Debit Note)
 what you ordered    goods arrive             what you owe       what you paid        goods sent back
 no stock, no money  STOCK goes up            MONEY OWED goes up  money owed goes down
```

| Step | Changes your stock? | Changes what you owe? |
|---|---|---|
| Purchase Order | No | No |
| Receive Stock (on the PO) or a linked GRN | **Yes** | Yes (when received) |
| Supplier Bill | **No** | **Yes** |
| Supplier Payment | No | Yes (goes down) |
| Debit Note | Only if goods go back | Yes (goes down) |

**A Supplier Bill never changes stock.** It only records the money. Stock goes up only when you receive the goods.

## 1. Add the supplier (once)

**Purchases → Suppliers → Add Supplier.** Enter name, phone, address, GSTIN and PAN if you have them, bank details for paying them, and an **opening balance** if you already owe them money.

Sarang stops you from creating the same supplier twice. It will not save a supplier if any of these already exist (active or archived):

- the same **phone number**,
- the same **GSTIN**,
- the same **email**,
- the same **name in the same city** (leave the city blank and any same name counts).

If the match is an archived supplier, Sarang tells you to restore that supplier instead. GSTIN, PAN and IFSC are checked for format (for example a GSTIN is 15 characters like *29ABCDE1234F1Z5*) and stored in capital letters. If two real suppliers share a name, add each one's city to tell them apart. **Find duplicates** on the Suppliers screen lists records that look like the same supplier and lets you **merge** them (a merge moves every bill and payment to the record you keep and cannot be undone).

Also useful on the supplier: a **contact person**, a **category** and **rating** for your own use, **payment terms** in days (a new bill then gets its due date automatically), and a **credit limit** (a reminder of how much you are willing to owe them; it is shown, it does not block a bill). An **opening balance** can be negative when you paid the supplier in advance. Like customers, a supplier can have **other addresses** on their page.

## 2. Make sure the product exists

Every item you buy for resale must be a **Product** first (**Inventory → Products**), with its **cost price** and **tax rate**. If it is a new item, create it now. You can also create it from the goods-received screen (step 4). Tax on a purchase never becomes part of your stock cost: the cost of stock is always the before-tax price.

Buying something that is not resale stock (rent, repairs, professional fees, equipment)? Skip products: enter it as a **Service** line on a Supplier Bill or as an **Expense**.

## 3. Order: Purchase Order (optional but recommended)

**Purchases → Purchase Orders → New PO.** Pick the supplier (or **+ Add New Supplier**), add items with quantity and cost, and an expected date. When you pick a product, its cost price **and its tax rate** fill in for you; you can change either.

The PO moves **Draft → Approved → Received**. If an approval rule is set it goes to an approver first. You can print the PO or send it to the supplier on WhatsApp or Email. Low stock? On the **Inventory** screen, **Generate Reorder POs** creates draft purchase orders for everything below its reorder level, using each product's default supplier.

## 4. Goods arrive: receive them

Two ways. Use whichever matches your business.

**A. Receive Stock on the Purchase Order** (simplest). Open the approved PO and click **Receive Stock**. Stock goes up, the average cost is updated, and your books record the purchase.

**B. GRN (Goods Received Note)** (when a delivery arrives in parts, or you want to record damaged or rejected quantity). **Purchases → GRN → New GRN**: pick the supplier, optionally link the PO, and enter each item with the received and rejected quantities and the cost.

**Important on a GRN: link every line to a product.** Each line has a product dropdown.

- Chosen from the list: the line adds to that product's stock when the GRN is **Posted**.
- Left as **Not in catalog**: the line is only a paper record. It shows a small *unlinked* tag and it does **not** change Inventory or Products.
- Item not in your list yet? Type its name and click **+ Create product "…" and link**. Sarang creates the product at your cost price and links the line. Set its real **selling price** in Products before you sell it.
- When you click **Post** on a GRN that has unlinked lines, Sarang warns you how many will not update stock. Cancel and link them, or post anyway.
- A posted GRN cannot be changed. If a line was posted unlinked by mistake, **Reverse** the GRN and enter it again with the product linked.

A GRN is saved as Draft, then Verified, then **Posted** (stock changes only at Posted).

**A line was posted unlinked and you cannot reverse the GRN?** On the posted GRN, an unlinked line has **Link to an item**. Choose the product and its quantity is added to stock. This links the receipt only; it does not change the purchase order's received quantity or any batch details, so check those yourself.

**Which of the two should I use?** The Purchase Order and GRN screens show a short hint that says which way you are receiving. Use one way for one delivery, never both: receiving on the PO and then posting a GRN for the same goods adds the stock twice.

## 5. Record what the supplier billed: Supplier Bill

**Purchases → Supplier Bills → Record Bill.**

1. Pick the supplier (or add one).
2. Set the **bill date** and the **due date**. The due date drives the Overdue list. If the supplier has payment terms, the due date fills in for you. Type the **supplier's own invoice number and date** as printed on their paper bill: Sarang warns you when the same supplier invoice number is entered twice, and GST businesses need it to match purchases against the government portal.
3. Add lines. A line is a **Product** (cost and tax fill in from the product) or a **Service** (free text, with a category, for things that are not stock).
4. Enter the bill's **discount** and **tax rate** per line so the totals match the supplier's paper bill. Check the total against the paper.
5. Tick **Reverse Charge** only if your accountant tells you the tax on this purchase is paid by you and not the supplier.
6. Optionally add **landed costs** (freight, duty, handling); they are spread over the items and raise their true cost.
7. **Save.** The bill gets a number (for example BILL-00012) and status **Open**. What you owe that supplier goes up. For a GST business the tax on the bill is recorded as **input tax credit** (unless you are on the Composition scheme), and a debit note reduces it again.

**Made a mistake?** While the bill is **Open** and has **no payment** recorded, open it and click **Edit bill**. Change what you need and save. Sarang replaces the bill under the same number, reverses the old entries and posts the corrected ones in one step, and keeps the old copy as *BILL-00012-R1 (Void)* so the history is complete. If a payment has been recorded, reverse the payment first. To cancel a bill altogether, use **Void** (reason required).

**Bill statuses:** Open, Partially Paid, Paid, Void. The list also has an **Overdue** filter and an **OVERDUE** badge on any open or part-paid bill whose due date has passed.

## 6. Pay the supplier: Supplier Payment

Open the bill and click **Record Payment**: amount (part or full), method (Cash, UPI, Card, Bank Transfer, Cheque), reference. The bill becomes **Partially Paid** or **Paid** and your balance payable falls. **Purchases → Supplier Payments** lists every payment you have made and lets you reverse a wrong one. Paying several bills to one supplier at once? Use the bulk payment option there.

If you deduct **TDS** when paying a professional or contractor, Sarang suggests an amount for the section you choose. Treat it as a suggestion only: confirm the section and rate with your accountant, because the rules changed in 2026. **Reports → TDS Deducted** lists what you deducted, by section, and how much is still to be deposited. On the payment form, **Ctrl + Enter** saves.

## 7. Send goods back, or correct a bill: Debit Note

**Purchases → Debit Notes → New.** Link it to the supplier (and the PO or bill). It reduces what you owe. Tick **Itemize** to list the returned items with tax. A debit note is your purchase return: it is the supplier-side twin of a Sales Return and a Credit Note.

## 8. See where you stand

- **Purchases → Purchases Overview**: what you owe, what is due in the next 7 days, open bills, and a list of the bills to pay this week.
- **Suppliers**: each supplier's page shows balance payable and every bill and payment; the **Statement** button opens their account to print or send.
- **Reports → Purchase Register, Purchases by Vendor, Purchases by Item, AP Aging Summary**: what you bought and what you owe, by how overdue it is.
- **Reports → Payables / Supplier Ledger**: a supplier's full account.
- **Reports → Purchase GST Register, Purchase HSN Summary, GST Net Payable & Input Credit** (GST businesses): purchases with their tax, purchases by HSN code, and the tax you can claim against the tax you charged. See *Guide: Tax and GST*.
- Ask Sarang: "Who do I owe money to?", "Which supplier bills are overdue?", "Bills due this week".

## A worked example

You buy 50 LED bulbs at 40 rupees, plus 18 percent tax, on 30 days' credit, and pay in two parts.

1. **Products**: create *LED Bulb 9W*, cost 40, tax 18.
2. **Purchase Order**: supplier *Amba Agencies*, 50 units. Approve.
3. **Receive Stock**: 50 bulbs arrive; Inventory now shows 50.
4. **Supplier Bill**: bill date today, due in 30 days; the line fills in as 50 x 40 with 18 percent tax; total 2,360. Status Open, you owe 2,360.
5. **Supplier Payment**: 1,000 by UPI (Partially Paid, owe 1,360), then 1,360 by bank transfer (Paid).
6. Ten bulbs are faulty: **Debit Note** for 10 x 40 plus tax, and send them back.
