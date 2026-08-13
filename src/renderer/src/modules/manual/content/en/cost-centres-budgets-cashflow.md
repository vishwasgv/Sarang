# Cost Centres, Budgets & Cash Flow

## Cost Centres

A **Cost Centre** (`/cost-centres`) is a tag — a department, branch, or project — that you can attach to an invoice, a bill, an expense, or an employee to see profit and spend broken down by that tag instead of just company-wide. Every business starts with zero cost centres, so nothing here appears anywhere else until you create your first one with **New Cost Centre** (a name and an optional short code).

Once at least one cost centre exists, an optional **Cost Centre** picker appears on the invoice checkout screen, the Bill form, the Expense form, and the Employee form — leave it blank and nothing changes; pick one and every accounting entry that transaction creates carries that same tag. An employee's own cost centre also tags their salary expense automatically when payroll marks them paid, so staffing cost rolls up by department without re-tagging every payslip by hand.

## Budgets

**Budgets** (`/budgets`) let you plan a monthly figure — for a specific cost centre, a specific account, or the whole company — and then see how real spend compared once the month is under way. Pick the month with the arrows at the top, then **New Budget** to set an amount against a scope: leave both Cost Centre and Account blank for a company-wide figure, set only a Cost Centre for a whole-department budget, or set both for a tightly-scoped one. The list shows Budgeted, Actual, and Variance side by side for the month you're viewing — Actual is always real transaction data, never estimated, so a budget against a cost centre that hasn't had any spend yet honestly shows zero rather than a gap.

You can't create two budgets for the exact same scope and period — edit the existing one instead, so "how much did we budget for Marketing this month" always has one answer.

## Cost Centre P&L Report

Under Reports, **Cost Centre P&L** shows real revenue, expense, and margin per cost centre for any date range you choose, drawn from the same tagged transactions the Budgets screen reads. Revenue and expense that were never tagged to any cost centre are shown separately as an "untagged" total, rather than silently left out — so the report's totals always account for everything, tagged or not.

## Statutory Compliance Summary

Sarang never applies official government PF/ESI/Professional Tax rules automatically — those change with every government notification, and a confidently wrong number is worse than an empty field. Instead, if you enter your own PF %, ESI % (with an optional wage ceiling), and Professional Tax amount in **Settings → Business Profile**, the Payroll screen gains a **Suggest from statutory rates** link next to each payslip's Deductions section. It pre-fills suggested deduction lines from your own configured rates — you still review, edit, or remove any line, and still have to press Save for it to count. Nothing is ever suggested for a rate you haven't set.

The **Statutory Compliance Summary** report (under Reports) totals what you actually recorded — every deduction line across every payslip for the month, grouped by name — as a real employer-liability figure for PF, ESI, Professional Tax, or anything else you've named as a deduction, whether it came from a suggestion or was typed in by hand.

## Cash-Flow Projection

The **Cash-Flow Projection** report (under Reports) shows a day-by-day chart split into two halves that meet at today: a solid line of **real** cash movement for the past month (money actually received minus expenses and supplier payments actually paid), and a dashed line of **projected** cash for the month ahead — built from open invoices and bills against their own due dates, plus any recurring expense that's scheduled to fall due in that window. It's a planning view, not a guarantee: only documents with a real due date are projected, and only recurring *expense* profiles are forecasted (a recurring invoice or bill's exact future total isn't estimated, to avoid a confidently wrong number).

## Payment Performance

The **Payment Performance** report (under Reports) shows, per customer, how many days it actually took to collect an invoice in full — measured from the invoice date to the date of its *last* payment, so a customer who pays in three instalments is only counted once they've genuinely finished paying. Invoices still carrying a balance show up as outstanding instead of skewing the average with a payment that hasn't finished yet. Use it to see which customers reliably pay fast and which consistently take longest, both per customer and as one overall average.
