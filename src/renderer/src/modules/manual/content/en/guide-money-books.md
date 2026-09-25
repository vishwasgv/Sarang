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
| A customer keeps back TDS when paying | The invoice is settled; "TDS Receivable" (tax you will get credit for) goes up instead of cash |
| Pay GST to the government (Accounting, GST Payments) | The tax you owe and the input credit you used go down, cash or bank goes down |
| Approve and repay a staff expense claim | A normal expense is recorded and cash or bank goes down |

Every posting has two sides that are always equal (debits equal credits). That is why the books balance.

## 2. Chart of Accounts

**Accounting → Chart of Accounts** is the list of accounts your books use, in groups: Assets (cash, bank, receivables, stock, fixed assets), Liabilities (payables, tax payable, loans), Equity (your capital and profit), Income and Expenses. Sarang creates the standard accounts for you. Add your own (for example a new bank loan or a special expense) with **Add Account**.

Click **Ledger** on any account to see every posting in it (see section 5).

## 3. Journal Entries: adjustments that are not a sale or purchase

**Accounting → Journal Entries → New.** Use a journal for things that are not ordinary sales or purchases: an opening balance, a write-off, an owner putting money in or taking it out, correcting an earlier posting. Add lines, each with an account and either a debit or a credit. **Total debits must equal total credits** or Sarang will not save it. Posted entries can be reversed (with a reason), not deleted, so there is always a trail.

Helpers on the journal form:

- **Templates (patterns)**: after you fill in the accounts and which side each is on, save the layout under a name (for example *Monthly rent*). Next time pick it and only type the amounts. Saving under an existing name replaces it.
- **Reverse automatically on**: for an accrual (an expense you record now that belongs to next month), choose the date the entry should undo itself. Sarang does it the next time it is open on or after that date, dated the day it runs. If the period is locked the reversal waits.
- **Memorandum notes** (fold-out at the bottom of Journal Entries): notes about things that are not accounting entries yet, such as goods sent on approval. They never change your books.
- **Keyboard**: press **Enter** on the last amount to add a balancing line and **Ctrl + Enter** to post.

## 4. Money in the bank

- **Bank Accounts**: add each bank account, then **Reconcile**: import or enter the bank statement lines and match them to what Sarang has recorded, so your books agree with the bank.
- **Post-Dated Cheques**: keep track of cheques you have given or received for a later date.
- **Bank Deposits**: record a deposit of cash and cheques to the bank.
- **Cash Close** (daily): count the cash in the drawer and record any difference.
- **Bank Rules** (Accounting → Bank Rules): tell Sarang that a statement line containing certain words (for example "electricity") belongs to a certain account. The screen lists imported statement lines the rules match; one click posts them to that account and marks them reconciled. Rules never run by themselves and a posted line can be undone from the reconciliation screen.
- **Expenses**: record every business cost with a category, vendor, and whether the tax is payable by you (reverse charge).
- **Expense Claims** (Accounting → Expense Claims): when staff pay for something from their own pocket, record the claim, then **Approve** (or **Reject**) it and **Repay** it. Repaying records a normal expense with the payment method you choose.

## 5. The statements, and how to read each

Open **Reports** and choose the **Financial** group. Choose a date range and run the report. Each one has a summary row, a chart, and a table; you can print, export to Excel or PDF, or share it.

**Profit and Loss Statement.** Income minus costs for a period: revenue, cost of goods sold, gross profit, expenses by category, net profit. *Question it answers:* did I make money this month?

**Balance Sheet.** What the business owns and owes **on one date**: assets on one side, liabilities plus your equity on the other, and a check line that shows they are equal. Current-period profit is included in equity so it balances. Choose **Compare with** an earlier date to see what changed. *Question it answers:* what is my business worth on paper, and how much is owed?

**Cash Flow Statement.** Where cash came from and went over a period: from running the business (operating), from buying or selling assets (investing), and from loans and owner money (financing), from opening cash to closing cash. A "reconciled" badge shows the closing cash agrees with your cash and bank accounts. *Question it answers:* I am profitable, so why is there no cash?

**Trial Balance.** Every account's debit or credit total for the period. If debits equal credits, the books are in balance. Click any row to open that account's ledger.

**General Ledger.** Pick one account and a date range. You get the opening balance, every posting with a running balance, and the closing balance, each with the document it came from (an invoice, a bill, a payment, a journal). Invoices and bills link straight to the document. Open it from **Chart of Accounts → Ledger**, from a **Trial Balance** row, or from the Reports list. *Question it answers:* why is this account showing this number?

**Day Book.** Every entry in date order, filterable by type (sales, purchases, receipts, payments, journals). Totals per day. *Question it answers:* what happened on this day?

**Cash Book.** A day-by-day register of every payment received and every payment or expense made, with a running balance.

**More reports for your accountant and for you** (all in the Reports list, each with a chart):

- **Ratio Analysis** (liquidity, debt, margins, days customers, suppliers and stock take) and **Fund Flow** (sources and uses of funds).
- **Bank Book** and **Bank Reconciliation Summary**.
- **Receivables Summary** and **Payables Summary** (who owes what and what falls due in the next 7 days), **Profit by Item** and **Profit by Customer**, **Year over Year**.
- **Profit by Cost Category** (revenue, expenses and profit added up by the category you gave each cost centre) and **Budget vs. Actual**.
- **Expenses by Category** and **Expenses by Vendor**, **Fixed Asset Register**.
- **Credit Note, Debit Note and Sales Return Registers**.
- **TDS Deducted**, **TDS Receivable** and (for GST businesses) **GST Net Payable & Input Credit**.

Some reports can also be saved to a folder automatically on a schedule (Settings → Business Features → Reports saved automatically); this only runs while Sarang is open.

## 6. Checks worth doing every month

1. **Trial Balance**: debits equal credits.
2. **Balance Sheet**: assets equal liabilities plus equity.
3. **Bank reconciliation**: the bank balance in Sarang equals the bank statement.
4. **Receivables and Payables**: the Outstanding report and the AP Aging Summary agree with the customer and supplier balances.
5. **Stock value**: the Inventory total is sensible against your last count.
6. Send the month's **Profit and Loss**, **Balance Sheet** and **Tax Report** to your accountant.

## Budgets, cost centres and several shops

- **Cost Centres** tag income and expenses by department or project. Give each cost centre a **category** (for example Department or Project) and **Profit by Cost Category** adds them up.
- **Budgets** set a planned amount per month. Beside your real plan (the **Base plan**) you can make **what-if plans**: choose **New what-if plan**, name it and raise or lower every figure by a percentage. **Budget vs. Actual** follows the plan you choose.
- **Several shops or branches?** Each shop keeps its own Sarang. **Accounting → Branch Summaries** exports a summary file from each shop and imports them into one place so the owner can see all shops together. Nothing syncs by itself.

## Foreign currency

Keep a table of exchange rates in **Settings → Business Features → Exchange rates** (add rates by hand or import a CSV). When you make a sale in a foreign currency the latest rate is filled in. Payments received in that currency record the exchange gain or loss.

## 7. Locking a finished period

**Accounting → Ledger Settings** lets you set a **lock date**. Nothing dated on or before it can be added, changed or reversed, which protects figures your accountant has already used for a return or audit. Set it only after your accountant confirms the period.

## 8. Year end

**Fixed Assets and Year-End Close** (its own chapter) covers posting depreciation and closing the year. After a close, the opening balances of the new year are carried forward automatically. Reports that show a balance on a date start from the latest opening entry.

## Sharing your books with your accountant

Create a login for your accountant with the **Accountant** role: it can look at reports, ledgers and statements and export them, and cannot change anything. Add it in **Settings → Users**. Send the month's Profit and Loss, Balance Sheet and Tax Report, or export the Trial Balance for them.

## Common questions

**Why does profit not equal the cash I have?** Profit counts sales you have not yet collected and purchases you have not yet paid for. The Cash Flow Statement shows the difference.

**Why is my Balance Sheet out of balance?** It should never be. If it is, do not fix it by hand: check for a period lock in the middle of the range, note the difference, and trace it in the General Ledger with your accountant.

**Can I delete an entry?** Entries are reversed, not deleted, so the record stays complete. Use Void, Cancel, Reverse or a Credit or Debit Note as the screen offers.
