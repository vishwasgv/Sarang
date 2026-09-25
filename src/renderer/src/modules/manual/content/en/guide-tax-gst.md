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
| Customer is exempt from tax | Mark the customer as tax exempt on their page and enter the exemption certificate number and the date it is valid until. Their invoices carry no tax while the certificate is valid; after the date Sarang charges tax again and the customer form shows a warning |
| Sale to a customer in another country (export) | On the Billing screen tick **Export sale?** (it appears when the customer's country differs from yours). The sale is then zero-rated. Sarang never does this by itself; check the export rules and keep proof of export |
| Your business is under the Composition Scheme | **Settings → Business Profile → GST Scheme → Composition Scheme.** Sales are then issued as a Bill of Supply with no separate tax |
| A purchase where **you** pay the tax (reverse charge) | Tick **Reverse Charge** on the supplier bill or expense. The tax is recorded as your own liability instead of part of what you owe the supplier |
| Overseas customer or supplier | Use the foreign-currency option on the document; amounts keep your currency's own decimals |
| A free sample or scheme item | Use **Give free** on the line, or let a pricing scheme add "buy 2 get 1 free" lines. Stock goes out; price and tax are zero |
| Delivery, packing or other charges | **Add Charge** on the Billing screen, with the tax rate that applies to that charge |
| The customer kept back income tax (TDS) when paying | Record it on the invoice payment window as **TDS deducted**. It is not money received; it is tax you will claim credit for (**Reports → TDS Receivable**) |

## Where you see tax totals

- **Reports → Tax Report:** tax collected on sales, by rate, and by tax category.
- **Reports → GSTR-1:** sales for the return, business-to-business per invoice and rate, business-to-consumer by rate and state, nil-rated, exempt and non-GST rows, and credit and debit note rows.
- **Reports → GSTR-3B Preview:** outward supplies (including zero-rated) and reverse-charge purchases for the month. It is a preview to compare with what the portal shows; filing is done on the government portal.
- **Reports → HSN Summary:** sales by HSN code (quotation lines carry the HSN code through to the invoice).
- **Reports → Purchase GST Register** and **Purchase HSN Summary:** the same for purchases (bills, received purchase orders and debit notes).
- **Reports → GST Net Payable & Input Credit:** the tax you charged, the input tax credit from your purchases, and what is left to pay or carry forward, by CGST, SGST and IGST.
- **Reports → GSTR-9 Annual Data:** a working paper of the year's figures for your annual return.
- **Reports → TDS Deducted:** tax you deducted from suppliers, by section, and how much is still to deposit.
- **Reports → TDS Receivable:** tax your customers kept back.
- On every printed invoice: the tax lines for the chosen presentation and, if it applies, the note "Prices include tax".

## Tax on purchases and input tax credit

Supplier bills, purchase orders and debit notes calculate tax the same way. Stock cost never includes purchase tax: for a bill or purchase order priced including tax, Sarang uses the before-tax cost for inventory value and average cost.

For a GST business on the regular scheme, the tax on each supplier bill, received purchase order and debit note is recorded as **input tax credit** in its own account. **GST Net Payable & Input Credit** shows what you charged, the credit you have, and the difference. Credit is only recorded for documents made from now on; earlier purchases are not counted, and the report says so. It also does not decide the order in which credit is set off against each head: your accountant decides that.

**Accounting → GST Payments** (India) records the payment you make to the government: it reduces what you owe in tax and the credit you used, and reduces your bank or cash. Check the amounts with your accountant before you pay.

**Accounting → GST Return Files** (India) prepares **GSTR-1** and **GSTR-3B** as JSON files you can upload yourself on the government portal or open in its offline tool: choose the month, prepare the file and save it. On an invoice's own page, the **e-invoice** and **e-way bill** cards prepare the request file for that invoice, and after you upload it by hand you type the IRN it returns so it prints with its QR code (**Reports → E-invoice IRN Register** lists them). All of these are drafts from your records. The layout of these files follows the portal's offline format as we understand it, so open each one in the government's own tool and correct anything it complains about before you rely on it. Nothing is sent to the government from Sarang.

**Matching your purchases with the portal:** download your GSTR-2B (or 2A) JSON from the portal and choose it in **GST Return Files**. Sarang matches it with your supplier bills by supplier GSTIN, invoice number and date, and lists what matches, what is different, what is missing in your books and what is missing on the portal. Type each supplier's own invoice number and date on the bill so the match works.

## Common mistakes

| Mistake | Result | Fix |
|---|---|---|
| Entering a tax-inclusive price on a before-tax document | Tax is added on top of a price that already had it | Turn on **Prices include tax** for that document, or enter the before-tax price |
| Forgetting to set the tax rate on a new product | Documents show no tax | Set it on the product |
| Using the wrong rate for an item | Wrong tax on every sale | Confirm the HSN and rate with your CA and correct the product |
| Choosing IGST for a same-state sale | One IGST line instead of CGST and SGST | Change **Tax shown as** on the document before saving, or cancel and re-issue, or use a Credit Note |
| Skipping tax on a credit note for a taxed invoice | The tax you charged stays on the books | Turn **Add tax to this note** back on |
