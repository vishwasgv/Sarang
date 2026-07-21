# Settings & Business Profile

Everything that shapes how Sarang behaves for your business lives under **Settings**, reached from the sidebar. The Settings screen has its own left-hand menu of sections — click any one to open it.

## Business Profile

**Settings → Business Profile** holds the details that print on every invoice and receipt: business name, owner name, phone, email, GST/VAT number, UPI ID, website, and full address (address, city, state, postal code). You can also upload a business logo (JPG, PNG, or WebP, under 2MB) and choose whether it shows on the Dashboard and/or as a faint watermark on printed documents.

If your business type is **Specialist Clinic**, an extra **Specialty** field appears (e.g. Pediatrics, Orthopedics, ENT). Click **Edit** to change any of these fields, then **Save Changes**. Country, currency, and tax model are shown here for reference but are changed from the **Currency & Locale** and **Tax Configuration** sections respectively.

## Tax Configuration

**Settings → Tax Configuration** manages the GST/VAT/sales-tax rates available at billing. Add a tax with a name (e.g. "GST 18%"), a type (GST, VAT, Sales Tax, Custom, or None), a rate between 0–100%, and optionally a country and a "default for this tax type" flag. Existing invoices are never affected when you edit or delete a tax rate — deleting only deactivates it going forward.

## Currency & Locale

**Settings → Currency & Locale** sets your currency (Sarang supports roughly 150 world currencies), your number format (Indian grouping like 1,00,000.00, US/International, European, British, Arabic, or Indonesian), and decimal places (0, 2, or 3). A live preview shows exactly how an amount will be formatted before you save.

## Switch Business / Industry Template

**Settings → Switch Business / Industry Template** is where you pick your business type — Restaurant, Retail, Pharmacy, Hardware, Distributor, Hotel/Lodge, Jewellery, Manufacturing, one of the professional-service types (Lawyer, Architect, CA Firm, and many more), and so on. Each template turns on a specific set of feature modules — for example, Restaurant enables Table Management, KOT printing, and recipe/ingredient tracking, while Pharmacy enables batch and expiry tracking. The screen shows the exact module list under each option so you know what you're getting.

Yes, **you can switch business types at any time** — pick a different template and click "Apply Template" (a confirmation dialog will ask you to confirm the switch first). This changes your sidebar navigation and feature set immediately — no restart required — and **all existing data is preserved**: every customer, product, invoice, and record stays exactly as it is, only which features are visible changes. Since this is a single-select choice, switching to a new template replaces your current module set rather than adding to it (a Retail shop that switches to Distributor loses the Retail-specific Returns module unless it's also turned on separately — see below).

## Additional Business Features

**Settings → Additional Business Features** lets you layer on feature modules from other business types on top of whatever your Industry Template already gives you — useful if your business genuinely spans more than one type (e.g. a retail shop that also does wholesale/dealer trade). These toggles are independent of your Industry Template and can be turned on or off at any time:

- **Returns Workflow** — accept product returns with automatic inventory and ledger reversal.
- **Area Pricing Calculator** — price by area (sq ft / sq m), useful for glass, plywood, or tiles.
- **Credit Limit Enforcement** — blocks a credit sale once a customer's outstanding balance would exceed their set credit limit. Only affects customers who actually have a credit limit set; walk-in customers default to no limit and are never blocked.
- **Bulk Order Workflow** — a separate bulk-order screen with volume-based discount tiers for wholesale/dealer customers.
- **Outstanding Analytics** — extra reporting on customer outstanding balances and aging.
- **Logistics & Supply Chain** — a bundle covering fleet, carriers, shipments, goods receipt (GRN), delivery challans, and freight tracking, for any business that moves goods via its own vehicles or wants to formally track supplier deliveries.

Two more cross-cutting features get their own dedicated Settings sections rather than living in this list: **Barcode & Loose Billing** and **AI Assistant** (see below, and their own manual chapters). Turning any of these features off does not delete existing data — it only hides the related screens and workflows.

## Barcode & Loose Billing

**Settings → Barcode & Loose Billing** is where you opt into barcode generation, barcode label printing, and loose/weight-based billing. All three are off by default for every business type. See the *Barcode & Loose/Weight Billing* chapter for full details on using these once enabled.

## AI Assistant

**Settings → AI Assistant** turns on **Ask Sarang**, an offline question-answering assistant over your own business data. Off by default. See the *Ask Sarang (AI Assistant)* chapter for what it can answer.

## Language

**Settings → Language** supports 13 languages: English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Gujarati, Spanish, French, Arabic, Portuguese, and Indonesian. Languages are grouped into **Global** and **Indian Languages** lists. Selecting a language changes the interface immediately — no restart needed. Choosing Arabic also switches the whole interface to right-to-left layout automatically.

## Appearance

**Settings → Appearance** has two controls:

- **Dark Mode** — a toggle switch for a dark colour scheme.
- **Print Type** — choose between **A4 Invoice** (full-page, colour), **Thermal 80mm** (standard POS receipt width), or **Thermal 58mm** (narrow POS receipt width). This determines the format used whenever you print an invoice or receipt.

Both preferences are saved automatically and remembered the next time you open Sarang.

## Users & Roles, Security, and Backup

Three more sections live in this same Settings menu but are covered in their own chapters: **Users & Roles** (see *Users & Permissions*), **Security** — where you change your own password (see *Users & Permissions*), and **Backup & Recovery**, which opens the dedicated Backup screen (see *Backup & Restore*).

## About

**Settings → About** shows your installed version number and Sarang's transparency statement (what data is and isn't collected — nothing is, since Sarang is fully offline).
