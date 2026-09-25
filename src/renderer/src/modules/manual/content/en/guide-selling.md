# Guide: Selling, From Quote to Money

Everything you do when a customer buys, in the order it happens. Skip the steps you do not need: a shop billing at the counter only needs step 4.

```
Quotation  ->  Sales Order  ->  Invoice (Billing)  ->  Payment  ->  (Return / Credit Note)
 optional        optional        always               when paid       only if something goes back
```

## 1. Add the customer (once)

**Sales → Customers → Add Customer.** Enter name and phone. Add address, email and tax number (GSTIN) if you bill businesses. Choose **Individual** or **Business**; a business also takes a company registration number and a contact person.

- **Search before you add.** Type the phone number first. Sarang blocks a second customer with the same phone number, so one person never becomes two records. It also checks the GSTIN and email, and the **Find duplicates** button on the Customers screen lists records that look like the same person so you can **merge** them. A merge moves every invoice and payment to the record you keep and cannot be undone.
- **Credit limit**: set it for customers who buy on credit. Sarang will not let a sale push them over the limit.
- **Payment terms**: type the number of days this customer usually gets to pay (for example 30). Every new invoice for them then gets its due date automatically.
- **Other addresses**: on the customer's page, **Other addresses** keeps a ship-to, warehouse or branch address next to the main one.
- **Tax exempt**: tick it for a customer who should not be charged tax. You can record the exemption certificate number and the date it is valid until. After that date Sarang charges tax again, and the customer form tells you the certificate has expired.
- **Do not send this customer messages**: tick it if they asked not to receive reminders or offers. Waiting reminders for them are removed and no new ones are offered for sending.
- **Statement**: the **Statement** button on the customer's page opens their account (every invoice, payment and credit note with a running balance) ready to print or send.
- **Archive, do not delete**, a customer you no longer serve. Their history stays.

You can also add a customer on the spot while billing (**+ Add Customer**, name and phone only).

## 2. Give a price: Quotation (optional)

**Sales → Quotations → New Quotation.** Pick the customer (or type a name), add items, and set **Valid until** (the last day the price holds). Save it as Draft, print it or share it on WhatsApp, and mark it **Sent**.

- When the customer agrees, open it and click **Convert to Invoice** (or **Convert to Sales Order** for a customer who has committed but is not being billed yet). The quotation becomes **Accepted**.
- **Quotations expire on their own.** The day after *Valid until*, a Draft or Sent quotation turns **Expired**. An expired quotation cannot be converted. If you decide to honour it, change its status back to **Sent**; Sarang clears the old expiry so it does not lapse again the same hour. Use the **Expired** filter to see who did not reply.
- **Proforma invoice**: choose *Proforma invoice* as the document type when you need to ask for payment in advance. It is numbered PF-, prints as "PROFORMA INVOICE, Not a tax invoice" and converts to a real invoice the same way a quotation does.
- Tax on each line comes from the product; you can change it on the line.

## 3. Confirm an order: Sales Order (optional)

**Sales → Sales Orders → New Sales Order.** Use it when the customer has said yes but you cannot bill yet (goods not ready, waiting for a deposit).

1. **New Sales Order**: customer, expected date, items. Each item picks up the product's price and tax rate.
2. **Confirm Order** to lock it. (If an approval rule is set, it waits for approval first.)
3. **Create Invoice** when you are ready. You can bill part now and the rest later; the order tracks how much is invoiced (*Partially Invoiced* then *Invoiced*).

An open Sales Order **promises** stock: **Inventory** and the Stock Summary report show how much is promised on orders, and Sarang warns you when you confirm an order for more than you have free. It is a warning only: nothing stops you selling promised stock, so check before you promise the last units. The order does not touch your books until you invoice.

## 4. Sell: the Billing screen (the main job)

**Sales → Billing.** This is the sale screen.

1. **Add items.** Search by name, SKU or barcode, or tap a product tile. Frequently sold products show as tiles above the search box. Use **Browse Products** to tap through categories without typing.
2. **Set quantity and discount** on each line. The small button beside the discount switches between **percent**, **amount** and **bargained/final price** (type the price you agreed and Sarang works out the discount).
3. **Pick the customer** (or leave blank for a walk-in).
4. **Choose how they pay**: Cash, UPI, Card, Wallet, **Credit (pay later)** (needs a customer; the invoice stays unpaid and adds to what they owe), or **Split** (for example part cash, part UPI).
5. **Tax.** Tax comes from each product. If you are on GST, **Tax shown as** picks CGST + SGST, IGST or a single GST line; Sarang chooses from the two states and you can change it. The amount of tax is the same whichever way it is shown. See *Guide: Tax and GST*.
6. **Extras on the bill.**
   - **Add Charge** adds a line for a tip, shipping or delivery, packing, handling, installation or another charge. Give the amount and, for anything except a tip, the tax rate that applies to it.
   - **Give free** (under a line's name) turns the whole line into a free sample or gift: the stock still goes out, the price and tax become zero, and the invoice shows it as free.
   - **Export sale?** appears when the customer is in another country. Tick it to charge no tax on this sale (a zero-rated export). Sarang never does this by itself, and the invoice notes say "Export supply, zero-rated". Check the export rules for your country and keep your proof of export.
7. Check the totals. The total is rounded by the rule you chose in **Settings → Currency & Locale → Invoice rounding** (none, nearest 0.05, 0.10, 0.50 or 1). The rounding shows as its own line.
8. **Confirm Sale** (or press **F10** or **Ctrl + Enter**). The invoice opens.

**Serving two customers at once?** **Hold Sale** parks the cart; **Resume Sale** brings it back.

**Wrong price or item?** Fix it before you confirm. After confirming, an invoice cannot be edited; cancel it (with a reason) and make a new one, or use a Credit Note for a partial correction.

**Sending goods to a customer in India?** For a GST sale of 50,000 or more Sarang reminds you about the e-way bill and lets you keep its number on the invoice. Other details for the delivery note (transporter, LR number) are on **Create Delivery Note**.

## 5. Give the customer their copy

On the invoice screen:

- **Print** (A4) or **Print Receipt** (thermal roll).
- **Share on WhatsApp** or **Email**: Sarang opens WhatsApp or your mail with the message ready. Attach the saved PDF and press Send yourself. Nothing is sent without you.
- **Create Delivery Note** if you are sending goods out.

## 6. Collect the money

- **Paid at the counter**: you chose the method in step 4; the invoice is already Paid.
- **Paid later**: open the invoice (**Billing → Invoice list**) and click **Record Payment**. Enter the amount (part or full), the method and a reference. A part payment leaves the invoice **Partial**.
- **The customer paid less because they kept back income tax (TDS)?** In the payment window choose **TDS deducted** and enter the tax they kept back. It settles that part of the invoice without any money arriving, and Sarang records it as tax you will get credit for. The **TDS Receivable** report lists it so you can match it to their certificates.
- **Payment recorded by mistake**: **Reverse** it with a reason. It stays on screen, struck through, for the record.
- **See all payments received**: **Payment History** (from the Billing screens), searchable by invoice, customer or reference.
- **Who owes me?** **Customers** shows each balance; **Reports → Outstanding** ages the dues (current, 1 to 30 days, 31 to 60, and so on). Ask Sarang can also answer "Who owes me money?".

## 7. When goods come back or a price was wrong

- **Whole or part of a sale returned**: **Sales → Sales Returns** (turn it on in **Settings → Additional Business Features** if you do not see it). Stock goes back on the shelf and the customer's balance or refund is adjusted.
- **Money owed back without a stock return** (overcharge, goodwill): **Sales → Credit Notes → New**, linked to the customer and the invoice. It reduces what the customer owes you. Each note has **Add tax to this note**: leave it on to give back the tax too, or turn it off for a plain amount.
- **Invoice made in error**: open it and **Cancel Invoice** (reason required).

## 8. Repeat customers and late payers

- **Recurring Profiles** (Accounting group) create the same invoice on a schedule, for rent, subscriptions and retainers.
- **Price Lists** give a customer group its own prices; **Pricing Schemes** run offers (buy 2 get 1 free, 10 percent off a category). Sarang shows the offer in the cart; you decide whether to apply it.
- **Interest on late payments**: turn it on in **Settings → Business Features → Interest on overdue balances** and set a yearly rate (simple or compound monthly). Nothing is charged by itself: on a customer's page you see the interest each overdue invoice has earned and press the button to charge it.

## 9. Sales overview and reports

**Sales → Sales Overview** shows sales and invoices today, what customers owe you and how much of it is overdue, open quotations, and shortcuts to every sales screen. **Reports** has sales by customer, item, category and salesperson (choose the salesperson at the counter), profit by item and customer, a sales register, receivables and more, each with a chart.

## Common questions

**Can I sell without stock?** Sarang blocks a sale of a stocked product when there is not enough in Inventory ("Insufficient stock"). Receive the purchase first, or adjust the stock with a reason. If you sometimes must sell before the goods are booked in, ask your accountant, then turn on negative stock in **Settings → Business Features → Stock rules**.

**Where do I see today's sales?** The **Dashboard**, or **Reports → Sales**.

**Why does tax appear on top of the price?** By default Sarang treats every price as *before tax* and adds tax on top. If your prices already include tax, turn on **Prices include tax** (Settings, or the switch on the document). See *Guide: Tax and GST*.

**Why is there no tax on this invoice?** The item has no tax rate, the customer is marked tax exempt, the sale was ticked as an export, or your business is on the Composition scheme.
