# Banking & Reconciliation

## Bank & Cash accounts

Open **Bank Accounts** from the sidebar and click **New Account** to add a named account — a real bank account (with bank name, masked account number, and IFSC) or a cash till/register, chosen via the **Account Type** field. This replaces a single undifferentiated "cash" bucket with as many real, distinct accounts as your business actually has — a main current account, a petty-cash drawer, a second branch's till — each tracked separately.

If the account already holds real money on the day you add it, enter that as its **Opening Balance**. Sarang posts a one-time balancing entry (Debit the account, Credit Owner's Capital) so the account's balance — and your books — are correct from day one, not silently starting at zero.

A bank account's **Current Balance** always reflects its real, running balance from every transaction posted against it — invoices paid into it, bills paid out of it, cheques cleared through it, and so on — never a number you edit directly.

## Importing and reconciling a bank statement

Open a bank account and go to **Reconciliation**. Click **Import Statement** to bring in your bank's own statement lines — date, description, debit or credit amount — the same rows your bank statement (PDF or CSV) already shows you, entered once rather than cross-checked by eye against every transaction in Sarang.

Once imported, click **Auto-Match** — Sarang looks for a Sarang transaction (a Payment, an Expense, a Supplier Payment, or a bank-linked Journal Entry line) with the same amount, dated within a few days of the statement line. When exactly one such transaction exists, it's reconciled automatically. When more than one could match, or none do, the line is deliberately left for you to review — a guess that happens to be wrong is worse than an honest "needs a look."

For anything auto-match doesn't resolve, open the line and reconcile it manually against the transaction it actually belongs to, or leave it unreconciled if it genuinely doesn't correspond to anything in Sarang yet (a bank fee, an interest credit). Already-reconciled lines can always be undone with **Unreconcile** if you matched the wrong one.

The **Reconciliation Summary** at the top of the screen shows your book balance next to the statement's own net movement, plus how many lines are reconciled versus still outstanding — the same "does my book agree with the bank" check an accountant would do by hand, done for you.

## Attaching the actual statement file

The original statement file itself — the PDF or CSV your bank sent you — can be attached directly to the account under the **Documents** panel on the Reconciliation screen, so the source document sits right alongside the parsed lines for as long as you need it, the same attach/open/delete behaviour every other document in Sarang already has.

## Post-Dated Cheques

Open **Post-Dated Cheques** from the sidebar to track a cheque register — cheque number, linked bank account, due date, amount, and direction (Received from a customer, or Issued to a supplier). A cheque you've recorded starts as **Pending** and doesn't touch your books yet, matching how a real post-dated cheque works: it's a promise, not yet a transaction.

When the cheque's date arrives and it actually clears at the bank, mark it **Cleared** — only then does Sarang post the real payment (Debit or Credit Cash, against the customer or supplier balance it settles). If it comes back unpaid, mark it **Bounced**; if it's cancelled before either outcome, mark it **Cancelled**. Both are simple status changes with no financial entry, since neither one ever became real money.

## Bank Deposit Slips

Open **Bank Deposits** to record a physical trip to the bank — cash and cheques you're handing over the counter. Pick the destination account and date, then enter how many notes of each denomination (₹500 down to ₹1) you're actually carrying; Sarang totals the cash for you as you type. If the account has any pending **Received** cheques waiting to be deposited, tick the ones going in with this same trip — their total adds to the slip, and each one moves from Pending to Deposited.

Only the cash portion is treated as real money the moment you save the slip — it's added straight to the destination account's balance, the same way a cash sale would be. The cheques you included aren't counted as money yet; each one still only affects your books once you separately mark it **Cleared** on the Post-Dated Cheques screen (a deposited cheque can still bounce), so nothing is ever double-counted. Click any past deposit in the list to see its full denomination and cheque breakdown again.

## Cheque Books

If you issue cheques to suppliers, click **Cheque Books** on the Post-Dated Cheques screen to register a physical cheque book against a bank account — just its start and end cheque number. When you then record an **Issued** cheque against that account, a **Use next cheque book number (#...)** checkbox appears; ticking it fills in the next sequential number from that book automatically instead of you typing it by hand, and the book's own "next" counter moves on so the same number is never suggested twice. A book that's fully used shows as **Exhausted**; deactivate a book you're no longer using so it stops being offered.
