# Ledger & Journal Entries

## What posts to the ledger automatically

Every real money-moving action you already take in Sarang — creating an Invoice, recording a Bill, receiving a Payment, paying a Supplier, logging an Expense, clearing a Post-Dated Cheque, running Fixed Asset depreciation — now also posts a real, balanced double-entry Journal Entry behind the scenes, automatically. You don't need to do anything differently day to day; this is what makes the Trial Balance, Chart of Accounts, and Bank Account balances all genuinely agree with each other rather than being separately-tracked numbers that could quietly drift apart.

Cancelling, voiding, or reversing any of those same actions posts a real mirrored reversing entry, not just a deletion — so the ledger always shows what actually happened, including corrections, rather than rewriting history.

## Chart of Accounts

Open **Chart of Accounts** from the sidebar to see the accounts your books are built from — Cash & Bank, Accounts Receivable, Inventory, Fixed Assets, Accounts Payable, Tax Payable, Owner's Capital, Sales Revenue, Cost of Goods Sold, Operating Expenses, and a few more — already set up for you the first time you use anything in this phase. Each has a type (Asset, Liability, Equity, Income, or Expense), which determines which side of the ledger it normally sits on.

Click **New Account** to add your own — useful if you want a more specific expense or income category than the defaults provide (e.g. splitting "Operating Expenses" into "Rent" and "Utilities" for your own tracking). Your own accounts behave exactly like the built-in ones everywhere else in the ledger.

## Posting a Manual Journal Entry

Most entries post themselves automatically as described above, but sometimes you need to record something by hand — correcting a misclassified expense, recording a non-cash adjustment, or any entry that doesn't correspond to one of Sarang's own transaction types. Open **Journal Entries** and click **New Entry**.

Add two or more lines, each against an account, as a debit or a credit — never both on the same line. Sarang totals both columns as you type and refuses to post until they match exactly; an entry that doesn't balance is rejected outright, the same discipline every other financial write in Sarang already enforces.

Already-posted entries can be reversed (with a required reason) if one was entered in error — this posts a real mirrored entry rather than deleting the original, so the correction itself is part of the permanent record.

## Transaction Locking

Open **Ledger Settings** to set a **Lock Date** — once set, no dated financial transaction (an Invoice, Bill, Payment, Supplier Payment, Expense, Journal Entry, or Purchase Order) can be created, edited, or voided on or before that date, across every part of the app. This is what keeps a closed accounting period closed: once you and your accountant have agreed a month or year is final, the lock date stops anyone (including you) from quietly changing it afterward.

## Credit Interest on overdue customers

If you charge interest on overdue customer balances, turn on **Credit Interest** in Settings with a rate and Simple-or-Compound type. From a customer's own record, you can then see the actual interest currently accrued on their overdue invoices — calculated per invoice from the date it actually went overdue, not a flat guess on the whole balance — and post it as a real charge to their account when you're ready to bill for it.

## Reverse Charge, Composition Scheme, and TDS

- **Reverse Charge (RCM)** — mark a Bill or Expense as reverse-charge when the supplier hasn't charged you GST and you're self-assessing it instead. Sarang keeps what you actually owe the supplier separate from the tax you owe the government, and surfaces the reverse-charge tax total in the GSTR-3B preview report.
- **Composition Scheme** — if your business is registered under the Composition Scheme (set in Settings), every Invoice you raise automatically carries no GST at all, and prints as a **Bill of Supply** instead of a tax invoice — matching what the law requires, without you needing to remember to zero out tax by hand on every sale.
- **TDS on vendor payments** — when recording a payment to a supplier, tick **Deduct TDS** and Sarang suggests an amount based on your configured threshold and rate, always yours to review and adjust before confirming. The withheld amount is tracked as its own liability, separate from what was actually paid out.

## Trial Balance

The **Trial Balance** report (under Reports) reads directly from the real ledger described above — every account's running balance as of the date you choose, debits and credits always summing to the same total by construction, since every entry that ever posted to it was itself required to balance.
