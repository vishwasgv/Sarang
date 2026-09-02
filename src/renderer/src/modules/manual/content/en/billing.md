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

Prefer clicking over typing entirely? Click the grid icon next to the search box to switch to **Browse Products** — every active product laid out as tiles, organized into category chips (All, plus one per category) so you can tap through to what you need without ever touching the keyboard. Sarang picks a sensible starting mode for you: Browse by default for a smaller catalog (roughly under 100 active products — a typical restaurant menu or small shop), Search by default for a larger one (so a Distributor or Electronics catalog running into the hundreds doesn't turn into an endless scroll) — but the toggle always lets you switch either way regardless of catalog size. If your catalog is large enough that Browse only shows the first batch of products, a note above the grid says so and points you back to search for anything not shown.

Mid-sale, need to help another customer without losing the current cart? Click **Hold Sale** to park it and start fresh; **Resume Sale** brings up your held carts to pick back up exactly where you left off. A product's **MRP**, when set higher than its selling price, shows as a struck-through reference price next to the real price in the search results.

If a product or category in the cart qualifies for an active **Pricing Scheme** (see the Sales Orders & Pricing chapter), a dismissible offer banner appears above the totals — "Add 2 more Widget free" or "10% off Notebooks" — with an **Apply** button. Applying a buy-X-get-Y-free offer adds a free line automatically; applying a discount offer sets that line's discount for you. Both are only ever suggestions you choose to apply — nothing changes in the cart on its own.

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

If a quotation is for an ongoing retainer engagement rather than a one-time sale, set its **Retainer Engagement** field (Fixed Fee, Hourly Bucket, or Deliverable-Based) when creating it. A quotation marked this way shows a **Convert to Retainer** button instead of (or alongside) Convert to Invoice — accepting it creates a recurring Retainer Agreement (the same kind you'd otherwise set up directly from Retainers, if your business type has that screen) rather than a single invoice.

## Credit Notes and Debit Notes

**Credit Notes** (`/billing/credit-notes`) record money owed *back to* a customer — typically for a return, an overcharge, or a goodwill adjustment. Create one with a reason and amount, optionally linked to a customer and/or the original invoice. Linking it to a customer automatically credits their ledger, reducing what they owe you.

**Debit Notes** (`/billing/debit-notes`) are the supplier-side equivalent — money a supplier owes you back, for example a return of purchased stock or a billing correction. Linking a debit note to a supplier debits their ledger, reducing what you owe them. Both credit and debit notes can optionally reference the invoice or purchase order they relate to, can be edited or deleted, and print at A4 or receipt width.

When creating either one, tick **Itemize this credit/debit note** to build the amount from real line items (a product or a free-text service, quantity, price, tax) instead of typing a single number — useful when the credit or debit covers specific returned or disputed items rather than a flat adjustment. The amount field becomes read-only and totals automatically once you switch to itemized mode. Itemization is only available when creating a new note; editing an existing one always uses the plain amount field.

## Invoice Templates

**Settings → Invoice Templates** lets you choose the accent color, footer text, and layout density (Comfortable or Compact) used whenever an invoice, quotation, or other document is printed. Four starter templates (Classic, Modern, Minimal, GST Detailed) come built in — Classic is the default and matches Sarang's original look exactly, so an install that never touches this screen prints exactly as it always has. Click **Set as Default** on any template to make it the one used everywhere, or **New Template** to create your own with a custom accent color and footer message (e.g. "Thank you for your business!"). Only your own custom templates can be edited or deleted — the four starters are fixed.

## Delivery Notes

Open any invoice and click **Create Delivery Note** to generate a dispatch document for that sale — the items, quantities, and customer are carried over automatically. This works for any business, independent of whether the Logistics module is turned on; if Logistics *is* enabled, the delivery note also appears alongside your regular Delivery Challans.

## Sharing documents via WhatsApp and Email

Invoices, Quotations, Credit Notes, and Debit Notes each have **WhatsApp** and **Email** share buttons (a chat-bubble icon and an envelope icon) next to their existing Print/Export controls. Clicking one:

1. Prompts you to save the document as a PDF — the same save dialog Print/Export already uses.
2. Opens the folder containing that PDF, with the file highlighted.
3. Opens your own WhatsApp (or email app), pre-filled with the customer's or supplier's phone number/email (from their saved contact details) and a short message with the document number and amount.

**You still attach the file yourself** — drag it from the highlighted folder into the WhatsApp or email window that just opened, then click Send. Sarang cannot attach the file automatically: neither WhatsApp's click-to-chat links nor `mailto:` links support attachments, so this one drag-and-drop step is a real limitation of both, not a missing feature. Nothing is ever sent automatically — Sarang only opens your own WhatsApp/email app pre-filled; you always click Send yourself.

If a customer or supplier has no phone number on file, the WhatsApp button is disabled. If they have no email on file, the Email button still opens your email app with the "To" field left blank for you to fill in.

Opening WhatsApp this way launches WhatsApp Desktop if it's installed, or WhatsApp Web in your browser otherwise. Opening Email launches whichever app is set as your computer's default mail app — if none is set, Windows will ask you to choose one; this is normal.

## Foreign-currency invoicing and settlement

If you sell to customers who pay in a foreign currency — an export sale, an overseas client — tick **Bill in foreign currency** while creating the invoice. Enter the three-letter currency code (e.g. `USD`) and the exchange rate at the time of billing (e.g. `83.25`); a live preview shows the invoice total converted at that rate. The invoice itself still totals and prints in your home currency as normal — the foreign-currency figure is an added reference line, both on screen and on the printed document (`≈ USD 1,200.00 @ 83.25`), not a second set of books.

Exchange rates move between the day you raise the invoice and the day you're actually paid, so **settling** a foreign-currency invoice is its own step. Open the invoice and click **Record Payment**: since it carries a foreign currency, a **Settle in {code} (records the actual amount received and any exchange-rate gain/loss)** toggle appears. Switch it on, enter the amount you actually received in the foreign currency and the exchange rate on the day of settlement (which can differ from the rate the invoice was raised at), and confirm. Sarang converts that to your home currency, settles the invoice in full, and automatically posts the difference between what the invoice was worth at the original rate and what it was worth at the settlement rate as a **Realized FX Gain** or **Realized FX Loss** journal entry (see the Ledger & Journal Entries chapter) — you never calculate or post that adjustment by hand.

The same foreign-currency billing and settlement flow is available on the purchase side for Bills you record from suppliers — see the Bills & Payments Made chapter.

## Notes on tax and rounding

Every invoice total is rounded to the nearest whole unit of currency, with the rounding difference shown as its own line so the math always adds up visibly. Under the GST tax model, tax prints as CGST+SGST for an intra-state sale or a single IGST line for an inter-state one, based on the checkbox set when the invoice was created.
