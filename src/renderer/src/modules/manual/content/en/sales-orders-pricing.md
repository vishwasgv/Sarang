# Sales Orders & Pricing

## Sales Orders

A **Sales Order** (`/sales-orders`) is a commitment to sell — the mirror image of a Purchase Order, on the sales side. Use it when a customer has confirmed they want something but you're not billing them yet: goods aren't ready to ship, a service hasn't started, or you're waiting on a deposit. A Sales Order never touches your books the way an invoice does — nothing is billed, and no ledger entry is posted, until you actually create an invoice from it.

Create one with **New Sales Order**: pick a customer (or add one inline without leaving the form), an optional expected date, and line items — each is either a real product or a free-text service, the same product-or-service choice Bills and Purchase Orders already use.

A Sales Order moves through **Draft → Confirmed → Partially Invoiced → Invoiced**, or **Cancelled** at any point before it's fully invoiced (with a required reason). Click **Confirm Order** to lock it in. From a Confirmed order, click **Create Invoice** — you don't have to bill the whole order at once: a partial-invoice screen lets you choose exactly how much of each line to bill now, leaving the rest for later. The order's detail screen keeps a running list of every invoice generated from it, so you can always see how much of the original order has actually been billed.

## Price Lists

**Price Lists** (`/pricing/price-lists`) let you set quantity-tiered pricing for a customer or a supplier — for example, a wholesale customer who pays less per unit once they buy 50 or more of something. Create a price list, choose whether it applies to customers or suppliers, then use **Manage Tiers** to set a grid of {product, minimum quantity, price} rows. Assign a price list to a specific customer or supplier from their own record.

When pricing a line for a customer or supplier who has a price list assigned, Sarang resolves the price automatically: the price list's own best-matching tier wins first, falling back to a per-customer-class price if one exists (a narrower, older mechanism some businesses already use), and finally to the product's plain selling or cost price if neither applies. You never have to think about which one is "on" — whichever is most specific to that customer or supplier wins.

## Pricing Schemes

**Pricing Schemes** (`/pricing/schemes`) are promotional offers, evaluated automatically at checkout: **Buy X Get Y Free** (e.g. buy 2, get 1 free) and **Quantity Discounts** (e.g. 5+ units gets 10% off, 10+ gets 15% off, using as many breakpoints as you like). Create a scheme, scope it to either one product or a whole category, set its rule, and optionally give it a start and end date for a limited-time offer.

At checkout, adding a qualifying product or quantity to the cart shows a dismissible offer banner with an **Apply** button — applying a Buy-X-Get-Y-Free offer adds the free line for you; applying a discount offer sets that line's discount automatically. These are always suggestions: nothing is applied until you click Apply, and the final invoice is independently checked against the real, current scheme rules when it's created — a scheme can never be tricked into under-pricing an invoice.

## Recurring Profiles

**Recurring Profiles** (`/recurring-profiles`) generate an Invoice, Bill, or Expense on a repeating schedule — Weekly, Monthly, Quarterly, or Yearly — so you don't have to re-create the same document by hand every period. Create one by choosing the document type, filling in the same details you would on a one-time Invoice/Bill/Expense, and setting a cadence, a start date, and an optional end date.

Sarang checks for due profiles automatically while the app is open (roughly once an hour) and generates the document silently — you'll never get a duplicate for the same period even if the app is closed when a period comes due, since the next check catches up. Pause a profile with **Pause** to stop it from generating without deleting it, or **Resume** to turn it back on. Delete a profile only stops *future* generation — documents it already created stay exactly as they are.

## Approval Workflows

**Approval Workflows** (`/approval-workflows`, usually configured by an Admin) require sign-off on a Sales Order or Purchase Order once its amount crosses a threshold you set — useful once a business has more than one person who can commit to a sale or a purchase. A workflow has one or more **steps**, each naming an approver (by role, e.g. "Manager", or by a specific person) and a minimum order amount that triggers that step; a step is silently skipped if the order's amount doesn't reach its threshold.

With no workflow configured — the default for every install — Sales Orders and Purchase Orders confirm instantly exactly as before; this feature is entirely opt-in. Once a workflow is active, confirming a qualifying order moves it to **Pending Approval** instead of confirming right away, and an approval panel appears right on the order's own detail screen listing each step and who needs to act. Approving or rejecting is done from that same panel — rejecting any single step rejects the whole order, while a fully-approved order finishes confirming automatically. A workflow with no approval history yet can be deleted outright; one that's already been used should be deactivated instead, which keeps its history intact but stops it applying to new orders.
