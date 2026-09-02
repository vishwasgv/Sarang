# Bills & Payments Made

## What a Bill is, and how it differs from a Purchase Order

A **Purchase Order** is what you *ordered* from a supplier. A **Bill** is what they actually *billed you for* — the two are related but not the same document. You can record a Bill without ever raising a Purchase Order first (the common case for a subcontractor's invoice, a rent bill, or any ad-hoc purchase), or you can link a Bill to an existing Purchase Order for reference.

Every Bill increases what you owe that supplier. A Bill's status moves through **Open → Partially Paid → Paid** as you record payments against it, or it can be **Voided** if it was entered in error (only while it still has no payments recorded — reverse any payments first).

## Recording a Bill

Open **Bills** from the sidebar and click **Record Bill**. Pick the supplier (or add a new one inline without leaving the form — the same **+ Add New Supplier** shortcut is available on the Purchase Order form too), then add one or more line items.

Each line is either:

- **Product** — a real item from your product catalogue, picked from a searchable dropdown. Its cost auto-fills from the product's own cost price, and you can adjust it if this particular purchase was priced differently.
- **Service** — free-text (e.g. "AMC — quarterly", "Legal consultation fee"), optionally tagged with a category. This is what closes the long-standing gap where every non-resale business purchase — office equipment, consumables, professional fees — had no structured home at all. Mix product and service lines freely on the same Bill.

Each line also carries its own discount amount and tax rate, so the Bill's totals are computed correctly per line before summing — the same discount-then-tax ordering every other document in Sarang already follows.

## Foreign-currency Bills

A Bill from an overseas supplier can be recorded the same way an invoice can — tick **Bill in foreign currency** when recording it, enter the currency code and the exchange rate, and the Bill carries a converted reference amount alongside its home-currency total, shown on screen and on print. When you settle it (see below), a **Settle in {code}** option appears the same way it does for invoices, and any gain or loss between the rate the Bill was recorded at and the rate on the day you actually pay is posted automatically as a Realized FX Gain/Loss journal entry — see the Billing & Documents chapter for the full walkthrough of how the toggle, preview, and settlement math work; it behaves identically here.

## Recording a payment against a Bill

Open a Bill and click **Record Payment**. Supplier payments accept Cash, UPI, Card, Bank Transfer, or Cheque — a wider set than customer-facing payments, since B2B payments routinely go by bank transfer or cheque. A payment can be partial; the Bill's balance and status update immediately, and the amount is deducted from what you owe that supplier.

Every payment you've made across all Bills also shows up in one place under **Payments Made** in the sidebar — searchable by bill number, supplier, or reference number, with the same reversal support (with a required reason) that Payments Received already has, in case one was entered by mistake.

## Purchase-side reports

Four reports, all under **Reports**, cover what you've bought and what you owe:

- **Purchase Register** — every Bill in a date range, with a spend-by-vendor chart and full line-level detail. This is the purchase-side equivalent of the Sales Report.
- **Purchases by Vendor** — total spend and bill count ranked by supplier, for spotting who you actually buy the most from.
- **Purchases by Item** — total spend and quantity ranked by product or service, separating real inventory items from free-text service lines.
- **AP Aging Summary** — what you currently owe each supplier, bucketed by how overdue it is (Current / 1-30 / 31-60 / 61-90 / 90+ days), the same aging logic the Outstanding report already uses for the supplier side, now as its own dedicated view.

## Vendor record depth

A supplier's own record (open it from **Suppliers**) can now also hold bank account/IFSC/bank name (for making a payment) and a PAN number (for compliance paperwork), plus an **opening balance** when you first add a supplier who already has real outstanding dues — it posts a one-time entry to their ledger so their balance is correct from day one.

## Individual vs. Business customers

A customer record (open it from **Customers**) now starts with an **Individual / Business** toggle. Business selects a company-registration-number and named-contact-person field; Individual selects an ID-proof type and number instead — matching what a distributor or B2B seller actually needs to record about who they're selling to, versus a walk-in retail customer.

## Expenses: vendor, mileage, and billable-to-customer

The **Expenses** form now also accepts an optional vendor/supplier (for a spend that has a real vendor but doesn't need a full Bill), a mileage breakdown (distance × rate-per-km, which computes the amount for you so the two numbers can never disagree), and a **bill this to a customer** field for a reimbursable expense you plan to charge back — e.g. travel a consultant bills onward to the client.
