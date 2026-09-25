# Guide: Tax and GST, How Sarang Calculates It

Sarang calculates tax the same way on every document, and shows you the same figures on the screen, on the saved document, on the printout, in the ledger and in the reports. This guide explains the rules, how to set them up, and where to see the totals. It is a working guide for your own records. Tax law changes and depends on your situation, so confirm your rates and returns with your accountant or CA.

## Two ways to enter prices

Every price in Sarang (cost price, selling price, unit cost) is either **before tax** or **including tax**, and every document says which.

- **Before tax (the default for India):** Sarang adds tax on top.
- **Including tax:** the price you type already contains the tax, as on a shelf label or an MRP. Sarang works the tax back out.

Choose the way you usually price in **Settings → Currency & Locale → Prices include tax**. That becomes the starting choice for every new document. On each document (invoice, quotation, sales order, purchase order, supplier bill, credit note, debit note) there is a **Prices include tax** switch, and the price column is labelled **(excl. tax)** or **(incl. tax)** so it is never ambiguous. Flipping the switch converts the prices you entered so the customer pays the same. On the Billing screen the switch is locked while the cart has items, so one bill never mixes both ways.

### The arithmetic

Before tax:

```
line amount   = quantity x price
taxable value = line amount - discount
tax           = taxable value x tax rate
line total    = taxable value + tax
```

Example: 2 units at 500, discount 100, tax 18 percent. Line amount 1,000. Taxable value 900. Tax 162. Total 1,062.

Including tax:

```
line amount   = quantity x price          (already contains tax)
after discount = line amount - discount
taxable value = after discount / (1 + rate)
tax           = after discount - taxable value
```

Example: 1 unit priced 118 including 18 percent tax. Taxable value 100. Tax 18. Total 118.

In both ways tax is worked out on the **discounted** value, an invoice-level discount is shared across the lines fairly, and the last line takes the leftover paisa so the lines always add up to the total. The subtotal, discount, tax and total are all whole units of your currency (paise, cents, fils) with no stray decimals.

### Rounding the total

**Settings → Currency & Locale → Invoice rounding** chooses how the payable total is rounded: **None**, **nearest 0.05**, **0.10**, **0.50** or **1**. Indian rupee businesses start on "nearest 1"; every other currency starts on "None". The rounding shows as its own line on the invoice. Credit notes and debit notes are never rounded this way.

## Set the tax rate once, on the product

**Inventory → Products →** the product **→ Tax Rate %**. Type a rate or click one of your saved rates. It then fills in on invoices, quotations, sales orders, purchase orders, supplier bills and debit notes when you pick the product. You can still change the rate on a single line. If a rate you type is not one of your saved rates, Sarang shows a gentle warning so a typing slip such as 81 instead of 18 is caught.

Also choose the product's **Tax category**: **Standard**, **Reduced**, **Zero-rated**, **Exempt**, **Nil-rated** or **Out of scope**. The category is remembered on each document line and drives the Tax Report and GSTR-1 rows for nil-rated, exempt and non-GST supplies. A line that actually charges tax can never be filed as exempt or nil-rated.

## GST rates in India

The GST rates changed on 22 September 2025. The working rates are now **5 percent**, **18 percent** and **40 percent** (a short list of luxury and sin goods), plus **nil**, with special rates of **3 percent** (gold, silver, jewellery) and **0.25 percent** (rough diamonds). The 12 and 28 percent rates were withdrawn. Sarang offers these as saved rates and keeps your old 12 and 28 percent rates visible under **Older rates (before 22 Sep 2025)** in **Settings → Tax Configuration**, so old records still make sense. Which rate applies to an item depends on its HSN code: ask your CA and set it on the product. Old documents keep the rate they were made with; changing a product's rate never changes past documents.

## How tax is shown: CGST + SGST, IGST, or GST

For a GST business every tax document has a **Tax shown as** choice:

| Choice | Use it when | What prints |
|---|---|---|
| **CGST + SGST** | Buyer in the same state | Two equal lines (for 18 percent, 9 plus 9) |
| **IGST** | Buyer in another state | One IGST line |
| **GST** | You want one combined line | One line named GST |

Sarang chooses for you by comparing your business state with the customer's (or, on purchases, the supplier's) state, and you can change it on the document. If the customer has no saved state but has a GSTIN, the first two digits of the GSTIN (the state code) are used. If neither is known, Sarang uses CGST + SGST.

**The tax amount and the total are exactly the same in all three choices.** Only the way the same amount is shown changes. When an amount does not split evenly, the two halves differ by at most one paisa and always add back to the whole tax. In the reports, a document shown as a single GST line is classified as CGST + SGST or IGST by its place of supply, and the report warns you how many documents had no state.

## Credit notes and debit notes: add tax or skip it

Every credit note and debit note has **Add tax to this note**. It starts on when the linked invoice, purchase order or bill carried tax, and off otherwise, and you can change it.

- **Skip tax:** the note total equals the amount; no tax lines print; the customer's or supplier's balance moves by that amount only.
- **Add tax:** a note built from items uses each line's tax rate; a plain-amount note asks for a tax rate and treats the amount as before-tax or including-tax according to the note's own price setting. Tax is shown as CGST + SGST, IGST or GST like any other document.

If you skip tax on a note linked to a document that charged tax, Sarang warns you that the tax you charged earlier will not be reversed; you can still continue. The Tax Report, GSTR-1 and GSTR-3B include a note's tax only when it was added.

## Special cases

| Situation | What to do |
|---|---|
| Customer is exempt from tax | Mark the customer as tax exempt on their page; their invoices carry no tax |
| Your business is under the Composition Scheme | **Settings → Business Profile → GST Scheme → Composition Scheme.** Sales are then issued as a Bill of Supply with no separate tax |
| A purchase where **you** pay the tax (reverse charge) | Tick **Reverse Charge** on the supplier bill or expense. The tax is recorded as your own liability instead of part of what you owe the supplier |
| Overseas customer or supplier | Use the foreign-currency option on the document; amounts keep your currency's own decimals |
| A free sample or scheme item | Add it as a line; a pricing scheme can add "buy 2 get 1 free" lines |

## Where you see tax totals

- **Reports → Tax Report:** tax collected on sales, by rate, and by tax category.
- **Reports → GSTR-1:** sales for the return, business-to-business per invoice and rate, business-to-consumer by rate and state, nil-rated, exempt and non-GST rows, and credit and debit note rows.
- **Reports → GSTR-3B Preview:** outward supplies (including zero-rated) and reverse-charge purchases for the month. It is a preview to compare with what the portal shows; filing is done on the government portal.
- **Reports → HSN Summary:** sales by HSN code (quotation lines carry the HSN code through to the invoice).
- On every printed invoice: the tax lines for the chosen presentation and, if it applies, the note "Prices include tax".

## Tax on purchases

Supplier bills, purchase orders and debit notes calculate tax the same way. Stock cost never includes purchase tax: for a bill or purchase order priced including tax, Sarang uses the before-tax cost for inventory value and average cost. A separate input-tax-credit report and a GST payment entry are being added; until they arrive, ask your accountant to work out the credit from your **Purchase Register** and the supplier bills.

## Common mistakes

| Mistake | Result | Fix |
|---|---|---|
| Entering a tax-inclusive price on a before-tax document | Tax is added on top of a price that already had it | Turn on **Prices include tax** for that document, or enter the before-tax price |
| Forgetting to set the tax rate on a new product | Documents show no tax | Set it on the product |
| Using the wrong rate for an item | Wrong tax on every sale | Confirm the HSN and rate with your CA and correct the product |
| Choosing IGST for a same-state sale | One IGST line instead of CGST and SGST | Change **Tax shown as** on the document before saving, or cancel and re-issue, or use a Credit Note |
| Skipping tax on a credit note for a taxed invoice | The tax you charged stays on the books | Turn **Add tax to this note** back on |
