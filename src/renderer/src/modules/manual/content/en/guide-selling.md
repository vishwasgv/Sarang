# Guide: Selling, From Quote to Money

Everything you do when a customer buys, in the order it happens. Skip the steps you do not need: a shop billing at the counter only needs step 4.

```
Quotation  ->  Sales Order  ->  Invoice (Billing)  ->  Payment  ->  (Return / Credit Note)
 optional        optional        always               when paid       only if something goes back
```

## 1. Add the customer (once)

**Sales → Customers → Add Customer.** Enter name and phone. Add address, email and tax number (GSTIN) if you bill businesses. Choose **Individual** or **Business**; a business also takes a company registration number and a contact person.

- **Search before you add.** Type the phone number first. Sarang blocks a second customer with the same phone number, so one person never becomes two records.
- **Credit limit**: set it for customers who buy on credit. Sarang will not let a sale push them over the limit.
- **Archive, do not delete**, a customer you no longer serve. Their history stays.

You can also add a customer on the spot while billing (**+ Add Customer**, name and phone only).

## 2. Give a price: Quotation (optional)

**Sales → Quotations → New Quotation.** Pick the customer (or type a name), add items, and set **Valid until** (the last day the price holds). Save it as Draft, print it or share it on WhatsApp, and mark it **Sent**.

- When the customer agrees, open it and click **Convert to Invoice** (or **Convert to Sales Order** for a customer who has committed but is not being billed yet). The quotation becomes **Accepted**.
- **Quotations expire on their own.** The day after *Valid until*, a Draft or Sent quotation turns **Expired**. An expired quotation cannot be converted. If you decide to honour it, change its status back to **Sent**; Sarang clears the old expiry so it does not lapse again the same hour. Use the **Expired** filter to see who did not reply.
- Tax on each line comes from the product; you can change it on the line.

## 3. Confirm an order: Sales Order (optional)

**Sales → Sales Orders → New Sales Order.** Use it when the customer has said yes but you cannot bill yet (goods not ready, waiting for a deposit).

1. **New Sales Order**: customer, expected date, items. Each item picks up the product's price and tax rate.
2. **Confirm Order** to lock it. (If an approval rule is set, it waits for approval first.)
3. **Create Invoice** when you are ready. You can bill part now and the rest later; the order tracks how much is invoiced (*Partially Invoiced* then *Invoiced*).

A Sales Order records the promise only. It does not reserve stock, and it does not touch your books until you invoice. Check stock yourself before promising the last units.

## 4. Sell: the Billing screen (the main job)

**Sales → Billing.** This is the sale screen.

1. **Add items.** Search by name, SKU or barcode, or tap a product tile. Frequently sold products show as tiles above the search box. Use **Browse Products** to tap through categories without typing.
2. **Set quantity and discount** on each line. The small button beside the discount switches between **percent**, **amount** and **bargained/final price** (type the price you agreed and Sarang works out the discount).
3. **Pick the customer** (or leave blank for a walk-in).
4. **Choose how they pay**: Cash, UPI, Card, Wallet, **Credit (pay later)** (needs a customer; the invoice stays unpaid and adds to what they owe), or **Split** (for example part cash, part UPI).
5. **Tax.** Tick **Inter-State Sale (IGST)** if the customer is in another state. The invoice then shows one IGST line instead of CGST + SGST.
6. Check the totals. If your business uses the Indian rupee, the total is rounded to the nearest rupee and the rounding shows as its own line; in other currencies the exact amount is kept.
7. **Confirm Sale** (or press **F10** or **Ctrl + Enter**). The invoice opens.

**Serving two customers at once?** **Hold Sale** parks the cart; **Resume Sale** brings it back.

**Wrong price or item?** Fix it before you confirm. After confirming, an invoice cannot be edited; cancel it (with a reason) and make a new one, or use a Credit Note for a partial correction.

## 5. Give the customer their copy

On the invoice screen:

- **Print** (A4) or **Print Receipt** (thermal roll).
- **Share on WhatsApp** or **Email**: Sarang opens WhatsApp or your mail with the message ready. Attach the saved PDF and press Send yourself. Nothing is sent without you.
- **Create Delivery Note** if you are sending goods out.

## 6. Collect the money

- **Paid at the counter**: you chose the method in step 4; the invoice is already Paid.
- **Paid later**: open the invoice (**Billing → Invoice list**) and click **Record Payment**. Enter the amount (part or full), the method and a reference. A part payment leaves the invoice **Partial**.
- **Payment recorded by mistake**: **Reverse** it with a reason. It stays on screen, struck through, for the record.
- **See all payments received**: **Payment History** (from the Billing screens), searchable by invoice, customer or reference.
- **Who owes me?** **Customers** shows each balance; **Reports → Outstanding** ages the dues (current, 1 to 30 days, 31 to 60, and so on). Ask Sarang can also answer "Who owes me money?".

## 7. When goods come back or a price was wrong

- **Whole or part of a sale returned**: **Sales → Sales Returns** (turn it on in **Settings → Additional Business Features** if you do not see it). Stock goes back on the shelf and the customer's balance or refund is adjusted.
- **Money owed back without a stock return** (overcharge, goodwill): **Sales → Credit Notes → New**, linked to the customer and the invoice. It reduces what the customer owes you.
- **Invoice made in error**: open it and **Cancel Invoice** (reason required).

## 8. Repeat customers

- **Recurring Profiles** (Accounting group) create the same invoice on a schedule, for rent, subscriptions and retainers.
- **Price Lists** give a customer group its own prices; **Pricing Schemes** run offers (buy 2 get 1 free, 10 percent off a category). Sarang shows the offer in the cart; you decide whether to apply it.

## Common questions

**Can I sell without stock?** Sarang blocks a sale of a stocked product when there is not enough in Inventory ("Insufficient stock"). Receive the purchase first, or adjust the stock with a reason.

**Where do I see today's sales?** The **Dashboard**, or **Reports → Sales**.

**Why does tax appear on top of the price?** Sarang treats every price as *before tax* and adds tax on top. See *Guide: Tax and GST*.
