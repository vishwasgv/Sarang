# Reports

## Finding a report

Open **Reports** from the sidebar. The left panel lists every report you have access to, grouped into categories — a category only appears if it has at least one report you're permitted to see and that applies to your setup. Universal categories present for every business are **Sales**, **Inventory**, **Finance**, **Customers**, **Suppliers**, and **Admin**. GST reports only appear if your business uses the GST tax model; business-type categories (Restaurant, Blood Bank, Jewellery, Logistics, Rental, Hotel, Service) only appear once the matching feature or business type is active for you.

Every report has a summary row, a chart and a table. Click a report to select it, set its filters (most take a date range; a few take a specific customer/supplier, a staff/provider, or a month instead of a day-range), and the report loads automatically. Once loaded, three export buttons appear: **CSV**, **Excel**, and **PDF**.

## Sales

The Sales Report breaks down revenue, discounts, and tax collected, grouped by day, week, month, or year as you choose.

The **Discounts & Bargained Pricing** report (also under Sales) shows exactly how much was given away via any per-line discount or bargained/Final-Price entry on the Billing screen — total discount given, what share of all sold lines were discounted, a breakdown by product (which items get haggled the most) and by staff member (useful for spotting a cashier who discounts unusually often). Every row links back to its invoice.

## Inventory

The Inventory Report shows current stock levels and valuation with low-stock alerts flagged, and can be filtered to low-stock items only. Related inventory-category entries appear once the matching feature is on: Batch & Expiry (batch tracking), Serial & Warranty (serial/IMEI tracking), Variant Stock (size/color variants), and Production (production orders).

## Customers & Suppliers

Customer Ledger and Supplier Statement each produce a full transaction statement for one specific customer or supplier that you search for and select — opening balance, every transaction in date order, and closing balance, plus a running-balance trend line so you can see at a glance whether their balance has been climbing or coming down over the period. This is also exactly how a contractor's running account works: every credit sale adds to their balance as it happens, and this statement is the month-end (or any date range) bill you hand them, already itemized and totaled — no separate "running account" setup needed. The Outstanding entry, under Finance, lists every customer and supplier with a pending balance in one place.

## Financial

This is the deepest category:

- **Profit & Loss Statement** — revenue, cost of goods sold, gross profit, expenses by category, and net profit, formatted to hand directly to an accountant.
- **Balance Sheet** — what you own and owe on one date, with a compare-with-earlier-date option.
- **Cash Flow Statement** — cash from operating, investing and financing activities from opening to closing cash.
- **Trial Balance** — every account's debit or credit total, with a grouped view (account types and their parent accounts) on screen.
- **General Ledger** — one account with a running balance and the document behind every posting. **Day Book** — every entry in date order.
- **Cash Book** — a day-by-day register of every payment received and every expense or supplier payment made, with a running balance.
- **Ratio Analysis**, **Fund Flow**, **Bank Book**, **Bank Reconciliation Summary**, **Year over Year**, **Fixed Asset Register**.
- **Receivables Summary**, **Payables Summary**, **Profit by Item**, **Profit by Customer**, **Sales Register**, **Expenses by Category** and **Expenses by Vendor**.
- **Credit Note Register**, **Debit Note Register**, **Sales Return Register**.
- **Budget vs. Actual**, **Profit by Cost Category**, and **Branch Consolidation** (shops' summaries imported into one place).
- **TDS Deducted**, **TDS Receivable**, **Tax by Part**, **Tax** (tax collected grouped by rate/type) and, outside India, **VAT / Sales Tax Return**.

Sales has **Sales by Customer**, **Sales by Item**, **Sales by Category** and **Sales by Salesperson**. Inventory has **Stock Summary & Valuation**, **Stock Ledger**, **Inventory Ageing**, **Stock by Location**, **Stock Transfers Register** and **Stock Count Variances**. Staff has **PF, ESI and Professional Tax by Employee**.

## GST / Tax entries

Only shown when your tax model is GST: GSTR-1 (B2B/B2CS tax summary for return filing), HSN-Wise Summary (Table 12 reference), Document Summary (invoice/credit note/debit note number series for Table 13), a GSTR-3B Reconciliation Preview to cross-check against what you've actually filed, **GST Net Payable & Input Credit**, **Purchase GST Register**, **Purchase HSN Summary**, **GSTR-9 Annual Data** and the **E-invoice IRN Register**. JSON files for GSTR-1 and GSTR-3B are prepared in **Accounting → GST Return Files** and are drafts to check in the government's own tool.

## Admin

Audit Log (full system action history) and Backup (history of every backup taken, with dates and file sizes).

## Business-type-specific entries

A long tail of entries only appear once the relevant business type or feature is switched on, and are covered in their own business-type chapters rather than here — for example Food Cost and Order Volume (Restaurant), Lab Test Throughput (Diagnostic Lab), Blood Stock (Blood Bank), Jewellery (Jewellery), Rental Status/Revenue (Rental), Room Occupancy/Guest Register (Hotel), Appointment Utilisation/Client Retention/Commission (appointment-based service businesses), Project and Job Card entries, Test Scores (Coaching Institute), and Compliance Tasks.

## Saving reports automatically

**Settings → Business Features → Reports saved automatically** saves a chosen report to a folder you pick, every day, week or month, as a CSV or Excel file. While Sarang is open it saves the last complete day, week or month. It runs only while Sarang is open, and there is a **Save now** button.

## Exporting

Every entry can be exported once it has run:

- **CSV** — a plain data export of the table.
- **Excel** — the same table as a proper .xlsx workbook.
- **PDF** — a formatted document with the summary numbers, any charts, and the full table, suitable for printing or sharing as-is.

## Sharing a report via WhatsApp or Email

If you have permission to view a report, a **WhatsApp** and an **Email** button appear alongside the CSV/Excel/PDF export buttons once it has loaded (report sharing is PDF-only — CSV/Excel export stays available separately, unchanged). Clicking one asks you to save the report as a PDF, opens the folder with that file highlighted, then opens your own WhatsApp or email app with a short message naming the report and its date range (the underlying figures aren't put in the message itself — they're in the PDF). As with document sharing elsewhere in Sarang, you attach the file yourself and click Send — nothing is ever sent automatically, and since a report isn't tied to one specific customer or supplier, both the phone number and the email "To" field start empty for you to fill in.
