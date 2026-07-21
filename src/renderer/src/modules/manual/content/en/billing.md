# Billing & Documents

## Creating an invoice

Open **Billing** from the sidebar (`/billing`) to reach the point-of-sale screen. This is where every invoice starts:

1. **Search for products** in the box on the left — by name, SKU, or barcode. Selecting a result (or scanning a barcode) adds it to the cart. If the product has variants (size/color) or tracked serial numbers (IMEI), a picker pops up so you choose the exact one before it's added.
2. **Adjust quantity and discount** on each cart line. Quantity steps by whole units, or by 0.1 for a weight-priced item. The small toggle button next to the discount field cycles through three modes: a **percentage**, a **currency amount**, or a **Bargained/Final Price** (shown as `=`) — for that last one, just type the final price you and the customer agreed on and Sarang works out the discount for you. This is the natural way to enter a haggled price (very common in Indian retail, hardware, and wholesale trade) without doing percentage math in your head. Bargaining can only ever reduce a line's price, never increase it above the listed price.
3. **Pick the customer**, on the right side. Type a name or phone number to search existing customers; if they're new, click **+ Add Customer** to quick-add just a name and phone without leaving the invoice. Leaving the customer field empty bills a walk-in customer.
4. **Choose a payment method**: Cash, UPI, Card, Wallet, Credit (Pay Later), or Split. **Credit** requires a customer to be selected — the invoice is created UNPAID and the amount is added to that customer's ledger. **Split** lets you enter separate Cash and UPI amounts that must add up to the invoice total.
5. **Apply a global discount** (in addition to any per-line discounts) if needed, using the discount box in the summary panel.
6. If your tax model is GST, tick **Inter-State Sale (IGST)** when the sale crosses state lines — this switches the printed tax lines from CGST+SGST to a single IGST line.
7. Click **Confirm Sale** (or press **F10** / **Ctrl+Enter**) to create the invoice. You're taken straight to the new invoice's detail screen.

The cart shows a running subtotal, discount, tax, rounding adjustment, and total as you build it. **Clear Cart** at the bottom resets everything without saving.

A tile grid of your **frequently sold products** appears above the search box — a tap adds it straight to the cart, no typing needed, ranked by what actually sells most.

Mid-sale, need to help another customer without losing the current cart? Click **Hold Sale** to park it and start fresh; **Resume Sale** brings up your held carts to pick back up exactly where you left off. A product's **MRP**, when set higher than its selling price, shows as a struck-through reference price next to the real price in the search results.

## Invoice history and detail

**Invoice List** (`/billing`, via the invoice list view) shows every invoice with its customer, item count, total, outstanding balance, and payment status (UNPAID / PARTIAL / PAID / CANCELLED). Search by invoice number or customer, filter by date range or by Active/Cancelled status.

Opening an invoice shows its full line items, tax breakdown, and payment history. From here you can:

- **Record Payment** — enter an amount (full or partial), pick a method (Cash, UPI, Card, or Wallet — Credit is not offered here since recording a payment means real money was received), and an optional reference number and remarks. Recording a payment updates the balance and payment status immediately; recording less than the full balance leaves the invoice PARTIAL.
- **Reverse a payment** — if a payment was recorded in error, reverse it with a reason. The reversed payment stays visible (struck through) for the audit trail.
- **Print** or **Print Receipt** — preview the A4 invoice or thermal receipt layout before sending it to the printer.
- **Cancel Invoice** — requires a reason and cannot be undone.
- **Send to Kitchen** — only appears for Restaurant-type businesses with KOT enabled, and only before a KOT already exists for that invoice.

**Payment History** is a separate screen listing every payment ever recorded, across all invoices — searchable by invoice, customer, or reference number, and filterable by payment method or date range. Reversing a payment can also be done from here.

## Quotations

**Quotations** (`/billing/quotations`) are non-binding price estimates you can hand to a customer before they commit. Create one with **New Quotation**: pick or type a customer name, add line items (searched the same way as Billing), an optional validity date, and notes.

A quotation starts as **Draft** and can be **Sent**, **Accepted**, or **Expired**. Once a customer agrees to it, click **Convert to Invoice** — this creates a real invoice from the quotation's items and marks the quotation Accepted. A quotation that has already been converted shows a link to its resulting invoice instead of the convert button. Quotations can be printed at A4 or receipt width, and deleted as long as they haven't been converted.

## Credit Notes and Debit Notes

**Credit Notes** (`/billing/credit-notes`) record money owed *back to* a customer — typically for a return, an overcharge, or a goodwill adjustment. Create one with a reason and amount, optionally linked to a customer and/or the original invoice. Linking it to a customer automatically credits their ledger, reducing what they owe you.

**Debit Notes** (`/billing/debit-notes`) are the supplier-side equivalent — money a supplier owes you back, for example a return of purchased stock or a billing correction. Linking a debit note to a supplier debits their ledger, reducing what you owe them. Both credit and debit notes can optionally reference the invoice or purchase order they relate to, can be edited or deleted, and print at A4 or receipt width.

## Notes on tax and rounding

Every invoice total is rounded to the nearest whole unit of currency, with the rounding difference shown as its own line so the math always adds up visibly. Under the GST tax model, tax prints as CGST+SGST for an intra-state sale or a single IGST line for an inter-state one, based on the checkbox set when the invoice was created.
