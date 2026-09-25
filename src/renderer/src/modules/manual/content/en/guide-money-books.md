# Guide: Money and Your Books

How the everyday things you do (selling, buying, paying, spending) turn into your accounts, and how to read the statements. This is for your own records and planning; it is not a substitute for advice from your accountant or CA.

## 1. How your everyday work becomes your books

You do not have to make accounting entries for normal work. Sarang posts them for you:

| You do this | Sarang records |
|---|---|
| Make a sale (invoice) | Money owed by the customer (or cash or bank if paid), sales income, and the tax you collected |
| Receive a payment | Cash or bank goes up, what the customer owes goes down |
| Receive stock on a Purchase Order | Stock and what you owe the supplier go up |
| Record a Supplier Bill | What you owe the supplier goes up; the cost or the stock is recorded |
| Pay a supplier | Cash or bank goes down, what you owe goes down |
| Record an Expense | The expense goes up, cash or bank goes down (or what you owe goes up) |
| Issue a Credit Note or Debit Note | The sale or purchase is reduced, and so is the balance |
| Post depreciation on a Fixed Asset | Depreciation expense goes up, the asset's value goes down |

Every posting has two sides that are always equal (debits equal credits). That is why the books balance.

## 2. Chart of Accounts

**Accounting → Chart of Accounts** is the list of accounts your books use, in groups: Assets (cash, bank, receivables, stock, fixed assets), Liabilities (payables, tax payable, loans), Equity (your capital and profit), Income and Expenses. Sarang creates the standard accounts for you. Add your own (for example a new bank loan or a special expense) with **Add Account**.

Click **Ledger** on any account to see every posting in it (see section 5).

## 3. Journal Entries: adjustments that are not a sale or purchase

**Accounting → Journal Entries → New.** Use a journal for things that are not ordinary sales or purchases: an opening balance, a write-off, an owner putting money in or taking it out, correcting an earlier posting. Add lines, each with an account and either a debit or a credit. **Total debits must equal total credits** or Sarang will not save it. Posted entries can be reversed (with a reason), not deleted, so there is always a trail.

## 4. Money in the bank

- **Bank Accounts**: add each bank account, then **Reconcile**: import or enter the bank statement lines and match them to what Sarang has recorded, so your books agree with the bank.
- **Post-Dated Cheques**: keep track of cheques you have given or received for a later date.
- **Bank Deposits**: record a deposit of cash and cheques to the bank.
- **Cash Close** (daily): count the cash in the drawer and record any difference.
- **Expenses**: record every business cost with a category, vendor, and whether the tax is payable by you (reverse charge).

## 5. The statements, and how to read each

Open **Reports** and choose the **Financial** group. Choose a date range and run the report. Each one has a summary row, a chart, and a table; you can print, export to Excel or PDF, or share it.

**Profit and Loss Statement.** Income minus costs for a period: revenue, cost of goods sold, gross profit, expenses by category, net profit. *Question it answers:* did I make money this month?

**Balance Sheet.** What the business owns and owes **on one date**: assets on one side, liabilities plus your equity on the other, and a check line that shows they are equal. Current-period profit is included in equity so it balances. Choose **Compare with** an earlier date to see what changed. *Question it answers:* what is my business worth on paper, and how much is owed?

**Cash Flow Statement.** Where cash came from and went over a period: from running the business (operating), from buying or selling assets (investing), and from loans and owner money (financing), from opening cash to closing cash. A "reconciled" badge shows the closing cash agrees with your cash and bank accounts. *Question it answers:* I am profitable, so why is there no cash?

**Trial Balance.** Every account's debit or credit total for the period. If debits equal credits, the books are in balance. Click any row to open that account's ledger.

**General Ledger.** Pick one account and a date range. You get the opening balance, every posting with a running balance, and the closing balance, each with the document it came from (an invoice, a bill, a payment, a journal). Invoices and bills link straight to the document. Open it from **Chart of Accounts → Ledger**, from a **Trial Balance** row, or from the Reports list. *Question it answers:* why is this account showing this number?

**Day Book.** Every entry in date order, filterable by type (sales, purchases, receipts, payments, journals). Totals per day. *Question it answers:* what happened on this day?

**Cash Book.** A day-by-day register of every payment received and every payment or expense made, with a running balance.

## 6. Checks worth doing every month

1. **Trial Balance**: debits equal credits.
2. **Balance Sheet**: assets equal liabilities plus equity.
3. **Bank reconciliation**: the bank balance in Sarang equals the bank statement.
4. **Receivables and Payables**: the Outstanding report and the AP Aging Summary agree with the customer and supplier balances.
5. **Stock value**: the Inventory total is sensible against your last count.
6. Send the month's **Profit and Loss**, **Balance Sheet** and **Tax Report** to your accountant.

## 7. Locking a finished period

**Accounting → Ledger Settings** lets you set a **lock date**. Nothing dated on or before it can be added, changed or reversed, which protects figures your accountant has already used for a return or audit. Set it only after your accountant confirms the period.

## 8. Year end

**Fixed Assets and Year-End Close** (its own chapter) covers posting depreciation and closing the year. After a close, the opening balances of the new year are carried forward automatically. Reports that show a balance on a date start from the latest opening entry.

## Common questions

**Why does profit not equal the cash I have?** Profit counts sales you have not yet collected and purchases you have not yet paid for. The Cash Flow Statement shows the difference.

**Why is my Balance Sheet out of balance?** It should never be. If it is, do not fix it by hand: check for a period lock in the middle of the range, note the difference, and trace it in the General Ledger with your accountant.

**Can I delete an entry?** Entries are reversed, not deleted, so the record stays complete. Use Void, Cancel, Reverse or a Credit or Debit Note as the screen offers.
