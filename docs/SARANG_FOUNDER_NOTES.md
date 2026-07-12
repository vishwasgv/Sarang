# Sarang Business OS — Founder Reference Document
### Maintained by Vishwas, Founder @ Aszurex | Last Updated: June 2026

---

## 0. Core Philosophy (Never Compromise These)

```
Offline First.  No Cloud.  No Data Collection.  Not Accounting Software.
Privacy by Architecture.  Free Forever.  Free for Everyone Globally.  Legally Clean.
```

Every product decision must pass this filter before being built. If a feature requires a server, touches user data outside the device, or implies tax/accounting authority — it does not ship.

**Sarang is one product.** It is built in three implementation phases to manage quality and scope — but there are no "versions" sold to users. When all three phases are complete, Sarang is the full product: 36+ industry templates, 6+ Indian languages, every billing document type, and the deepest offline business OS in the market.

**The name "Sarang" (सारंग):** In Sanskrit and across Indian languages, Sarang refers to a peacock, a spotted deer, a bee, a lotus — things that are beautiful, free, and native to the land. This software is built for India (and the world), is free, and beautiful by design.

**This document is the canonical source of truth for all Sarang product decisions.** Every feature request must clear Section 0 before acceptance. Every phase must be approved by Vishwas before execution.

---

## 1. Market Reality — What the Research Says

### 1.1 The Indian MSME Landscape

- **63 million+ MSMEs** registered in India (Udyam portal, 2025)
- **45–50% (~30 million)** use some form of digital billing or record-keeping
- Only **29%** of tech-aware MSMEs use accounting software — rest use Excel, Khata books, or nothing
- **36% struggle with tech adoption**; 18% cite high costs as the primary reason
- Market preference: **65% prefer simple, customizable tools** over complex ERPs
- India business software market: **USD 16.54 billion (2025) → USD 33.72 billion by 2032** (CAGR 10.76%)
- Top 5 states by MSME count: UP, Maharashtra, Tamil Nadu, West Bengal, Karnataka

**TAM / SAM / SOM:**

| Level | Definition | Size |
|---|---|---|
| **TAM** | All MSMEs globally that could benefit from a business OS | 500+ million businesses worldwide |
| **SAM** | MSMEs with a computer/laptop + some digital literacy + in covered industries | ~8–10 million (India); ~30 million (global) |
| **SOM** | Realistic first-3-year target: South India + Hindi belt MSMEs | 500,000 active installs |

### 1.2 The South Indian MSME Opportunity

**Karnataka:**
- 3.8 million+ registered MSMEs
- Bangalore: tech-aware business owners who demand good software
- Dharwad, Hubli, Mysuru, Belgaum: traditional trade, massive underserved base
- **Silk industry** centred in Mysuru/Ramanagara — global export hub, undigitized at grassroots
- **Garment manufacturing**: 4,000+ units in Bangalore alone
- **Coffee estate supply chain**: Kodagu and Chikkamagaluru — needs procurement + export billing
- **Granite/stone**: Raichur and Ballari — export-oriented, needs international billing
- GST state code: 29

**Tamil Nadu:**
- 4.2 million+ registered MSMEs — highest in South India
- **Tirupur**: global knitwear capital — $4.5B export, 10,000+ garment units
- Chennai: automobile ancillary + pharma manufacturing
- Coimbatore: engineering goods + textile machinery
- Highest density of CA firms per capita in India — natural Sarang CA partner base
- GST state code: 33

**Kerala:**
- Most educated MSME owners in India — literacy rate 96.2%
- Tourism-driven businesses: resorts, homestays, restaurants (Ayurvedic too)
- **Gold jewellery retail**: Thrissur — India's gold capital
- **Fishing and seafood**: Kochi, Kollam, Kozhikode — massive MSME segment
- Large NRI community = international billing important here
- GST state code: 32

**Andhra Pradesh + Telangana:**
- Combined 5.5 million+ MSMEs
- Hyderabad: pharma + IT MSMEs
- Guntur: chilli, cotton, tobacco — world's largest chilli producer
- Coastal AP: prawn and fish processing — export to Japan, EU, US
- GST state codes: 37 (AP), 36 (Telangana)

**Maharashtra:**
- 7.9 million+ registered MSMEs — 2nd largest state economy, 3rd by MSME count
- **Pune**: Pharma manufacturing (Hinjewadi), auto ancillary (Chakan), IT service firms — all need billing and expense tracking
- **Mumbai / Navi Mumbai**: Wholesale textile (Bhiwandi is Asia's largest powerloom cluster), FMCG distribution, electronics trading (Lamington Road / Manish Market)
- **Nashik**: Wine industry + onion trading + engineering goods — niche but concentrated MSME base
- **Aurangabad, Kolhapur, Nagpur**: Manufacturing and agro-processing MSMEs
- Marathi is a Phase 1 language — Maharashtra market must be ready from day 1
- GST state code: 27

**Gujarat:**
- 5.7 million+ registered MSMEs — highest per-capita business formation rate in India
- **Surat**: Diamond cutting and polishing — $24B export, 500,000+ diamond workers, most are small unit owners; also the largest synthetic textile hub in India
- **Ahmedabad**: Textile (Ashram Road + Raipur mills), chemicals, FMCG
- **Rajkot**: Engineering goods, auto parts — 5,000+ MSME engineering units
- **Jamnagar**: Brass parts manufacturing — global export hub, 500+ units
- **Anand/Amul belt**: Dairy cooperatives + agro-processing MSMEs
- Gujarati trading community: highest business-to-population ratio in India; early technology adopters
- Gujarati is a Phase 1 language — Gujarat market must be ready from day 1
- GST state code: 24

**North India (Phase 2 target markets):**
- **UP, Punjab, Haryana**: Agricultural produce trading, dairy, spice wholesale
- **Rajasthan**: Handicrafts, textile, stone mining
- **Delhi NCR**: Wholesale trading, electronics, FMCG distribution

**Why all 5 South Indian languages ship first:**
- South India = 22% of India's GDP with 18% of population
- South Indian states are net GST contributors
- Literacy and smartphone penetration are highest here
- This is Vishwas's home market — it must be right from day 1

### 1.3 Competitive Map

| Product | Model | Strength | Weakness | Price |
|---|---|---|---|---|
| **Tally Silver** | One-time desktop | Every CA knows it, 40-year moat | Old UI, no mobile, ₹18k + ₹4,500/yr renewal | ₹18,000 |
| **Vyapar** | Freemium mobile+desktop | 1 crore+ users, WhatsApp sharing, Hindi | Accounting-first, no industry depth, no Kannada/Tamil | Free + ₹2,499/yr |
| **Zoho Books** | Cloud subscription | 40+ apps, GST, e-invoice | Needs internet, ₹3,999/yr, data stored on Zoho servers | ₹3,999/yr |
| **Busy Accounting** | Desktop | Textile/pharma depth, GST | 2004-era UI, no South Indian languages | ₹9,000–₹18,000 |
| **Marg ERP** | Desktop | Pharma/FMCG distribution | Industry-specific, poor UX, no regional languages | ₹10,000+ |
| **ERPNext** | Open source / cloud | Free, e-invoice, 150+ countries | Needs server, not truly offline | Free + hosting |
| **Khatabook** | Free mobile app | 5 crore+ Indian users, Hindi + 11 languages, simple UdhaarBahi | Credit-only (khata/ledger), no billing, no inventory, cloud-synced, data on their servers | Free |
| **OkCredit** | Free mobile app | 50M+ users, daily collections, cash flow view | Credit-only, no invoice generation, no stock, cloud, data on their servers | Free |
| **Sarang** | Free offline desktop | Modern UI, RBAC, privacy-absolute, 39 templates | Building now | Free |

**Why Khatabook and OkCredit matter:** Combined 55+ million users — bigger than Tally's user base. They solve credit tracking (Sarang's Feature 14). When Sarang launches with full billing + inventory + credit + 8 languages, it is a direct upgrade from both. The pitch: "You're using Khatabook for credit and writing invoices by hand — Sarang replaces both, works offline, and your data stays with you."

### 1.4 The Real Gap Sarang Fills

**No product in the market is simultaneously:**
- Truly offline (zero cloud dependency)
- Free forever for everyone globally
- Industry-template driven (36 industries, one engine)
- Privacy-absolute (zero data collection, legally defensible globally)
- Modern UI that a 55-year-old can use
- Multi-language Indian — all 5 South Indian languages + Hindi

That is the white space. Own it. Do not drift from it.

### 1.5 International Opportunity

- **Southeast Asia**: Indonesia (64M MSMEs), Vietnam, Thailand — same problem, poor connectivity, local languages
- **Middle East**: UAE, Saudi, Kuwait — 3 million Indian diaspora running retail, restaurant, construction businesses
- **Africa**: Nigeria, Kenya, Ghana — massive informal economy, unreliable internet
- **South America**: Brazil, Colombia — informal economy, poor ERP penetration
- **Sri Lanka, Bangladesh, Nepal**: Indian MSME software exports are natural here

**Pricing decision: Sarang is free globally.** No geographic price discrimination. Aszurex service engagements are the revenue model in every market. Pricing review deferred — see Section 18.

---

## 2. Legal Positioning — This Is Critical

### 2.1 What Sarang Is and Is Not

**Sarang IS:** A business operations management tool. A records and transaction organiser. A document generation assistant. An inventory and workflow tracking system. A business intelligence reference tool.

**Sarang is NOT:** Accounting software. Tax advisory software. Legal compliance software. A replacement for a CA/CPA. A government-certified financial reporting system. A statutory audit tool. A payroll or PF/ESIC compliance system.

### 2.2 Required Disclaimers (Non-Negotiable — Build Into UI)

**On first run (one-time, user must check "I understand"):**
```
Sarang Business OS is a business operations management tool.
It is NOT accounting software, tax advisory software, or a certified 
financial reporting system. All data, calculations, and reports are for 
internal operational reference only.

Users are solely responsible for verifying all calculations, complying 
with applicable tax laws, and consulting qualified professionals 
(Chartered Accountant, tax advisor, legal counsel) for all compliance decisions.

Aszurex Private Limited accepts no liability for any financial, tax, or 
legal decisions made based on this software.

By using this software, you agree to the full terms at aszurex.com/sarang-terms.
```

**aszurex.com/sarang-terms MUST be live before Sarang ships. Hard dependency.**

**On every report/summary screen (footer):**
> "For internal reference only. Consult a CA for certified financial statements."

**On the GST Summary screen:**
> "This is a reference summary. It does not constitute a GST return. File on the GSTN portal or via a GSP."

### 2.3 Legal Protection by Architecture

Because Sarang stores ALL data locally:

- **GDPR (EU)**: Compliant by architecture. Aszurex never receives user data. Users are their own data controllers.
- **India DPDP Act 2023**: No personal data flows outside the user's device. Zero breach liability.
- **US CCPA**: No data collected = no compliance burden.
- **Singapore PDPA, UAE Law No. 45/2021, Kenya DPA 2019, Indonesia PDP 2022**: All same logic.

**The most powerful marketing line:**
> "We cannot breach your data because we never have it."

### 2.4 Legal Red Lines — Never Build

- ❌ IRN/e-invoice routing through Aszurex servers
- ❌ Bank account integration through any Aszurex endpoint
- ❌ UPI payment processing or settlement confirmation
- ❌ Any telemetry, crash reporting, or analytics — even anonymized, even opt-in
- ❌ Silent auto-update that phones home to Aszurex
- ❌ Cloud backup on Aszurex infrastructure
- ❌ "Certified", "Approved by GSTN", "CA Compliant" language anywhere
- ❌ Payroll with PF/ESIC deduction (statutory compliance territory)
- ❌ Form 16 / certified salary slip
- ❌ GSTN API calls routing through Aszurex
- ❌ Chrome extension

### 2.5 What Is Safe to Build

- ✅ Local file-based backup and restore (user-chosen location)
- ✅ User-initiated export to PDF, Excel, CSV — all local
- ✅ UPI QR code display (generated locally from UPI VPA, no network call)
- ✅ Barcode generation locally (JsBarcode / bwip-js)
- ✅ E-invoice: user's own GSP credentials, direct API call from user's machine
- ✅ Tax rate lookup from locally stored rate tables
- ✅ WhatsApp-formatted text generation (user copies and pastes — no API)
- ✅ Attendance records and salary reference display (labelled "for reference only")
- ✅ "Check for Updates" button — user-triggered, checks GitHub Releases API, opens browser
- ✅ Local rotating log file for crash diagnostics (stored on device only, never transmitted)

### 2.6 Trademark and Brand Protection

- File trademark for "Sarang" (Class 42 — Software) in India before public launch
- File in UAE and EU if budget allows
- Source-Available license (Section 15) prevents commercial redistribution
- Register sarang.aszurex.com domain before launch
- **International pricing: Sarang is free globally** — no regional pricing, no paywalls

---

## 3. Language Strategy — Ships with ALL 6 Languages

### 3.1 Language Priority — Final Decision

**Ships first (non-negotiable) — 8 languages:**
- English (en) — default fallback
- Hindi (hi) — 53 crore native speakers, North India
- Kannada (kn) — Karnataka, Vishwas's home state, 4.5 crore speakers
- Tamil (ta) — Tamil Nadu + global diaspora, 8 crore speakers
- Telugu (te) — AP + Telangana, 8.3 crore speakers
- Malayalam (ml) — Kerala, most educated MSME base, 3.5 crore speakers
- Marathi (mr) — Maharashtra, 8.3 crore speakers; 2nd largest state economy
- Gujarati (gu) — Gujarat + global trading diaspora, 5.5 crore speakers; highest MSME density in India

**Phase 2 additions:**
- Punjabi (pa) — Punjab + Haryana, 3 crore speakers
- Bengali (bn) — West Bengal + Bangladesh, 10 crore speakers

**Phase 3 — International:**
- Arabic (ar) — RTL, UAE/Saudi/Kuwait diaspora
- Indonesian (id) — 280M population, largest SE Asian market
- Swahili (sw) — East Africa
- Portuguese (pt-BR) — Brazil

### 3.2 Translation Ownership Plan

**Owner: Vishwas** — signs off on all translations before shipping.

| Language | Translator | Review |
|---|---|---|
| English | Vishwas | Self-review |
| Hindi | Vishwas / freelancer | Hindi-speaking beta user |
| Kannada | Vishwas (native) | Community via GitHub |
| Tamil | Paid freelancer (Tirupur MSME context) | Beta user in Tamil Nadu |
| Telugu | Paid freelancer (Hyderabad/Guntur context) | Beta user in AP/Telangana |
| Malayalam | Paid freelancer (Kerala business context) | Beta user in Kerala |
| Marathi | Paid freelancer (Pune/Mumbai business context) | Beta user in Maharashtra |
| Gujarati | Paid freelancer (Surat/Ahmedabad trading context) | Beta user from Gujarati trading community |

**Budget estimate — freelance translations:** ₹8,000–₹15,000 per language (full UI string set, ~1,500 keys, with business vocabulary review). 6 non-English languages = ₹48,000–₹90,000 total. Tamil + Telugu + Malayalam + Marathi + Gujarati + Hindi = 6 contracts. Budget ₹1,00,000 for translations with buffer.

**Rules:** No machine translation for UI strings. Business terms must use vocabulary an MSME owner uses. Test every string at 1366×768 — some scripts produce wider text than English. Numbers always in Arabic numerals (0-9) unless user opts into Devanagari.

### 3.3 i18n Architecture

```
src/renderer/src/i18n/
├── index.ts              ← i18next init, detector, fallback chain
├── types.ts              ← TypeScript types for all translation keys
└── locales/
    ├── en/ hi/ kn/ ta/ te/ ml/ mr/ gu/   ← ships first (8 languages)
    ├── pa/ bn/                             ← Phase 2
    └── ar/ id/ sw/ pt-BR/                 ← Phase 3 (ar = RTL)
    Each folder: common.json | billing.json | inventory.json |
                 customers.json | reports.json | settings.json |
                 auth.json | errors.json
```

**Critical rules:**
1. All locale files bundled inside Electron app — no network fetch ever
2. `i18next-electron-language-detector` for OS language auto-detection
3. Fallback chain: detected language → English
4. RTL support: CSS logical properties from day 1 (`margin-inline-start`, not `margin-left`)
5. `Intl.NumberFormat` for Indian (1,23,456.78) vs International (123,456.78) number formatting
6. Currency stored as raw number in DB, formatted at display time only

### 3.4 South India Market Notes Per Language

**Kannada (ಕನ್ನಡ):** Script U+0C80–U+0CFF. Key sectors: Silk (Mysuru), garments (Bangalore), coffee (Kodagu), granite (Raichur), seafood (Mangaluru). A Kannada UI signals respect.

**Tamil (தமிழ்):** Script U+0B80–U+0BFF. Key sectors: Knitwear (Tirupur), engineering (Coimbatore), leather (Vellore), silk (Kanchipuram), seafood (Rameswaram, Tuticorin).

**Telugu (తెలుగు):** Script U+0C00–U+0C7F. Key sectors: Pharma (Hyderabad), pearls (Hyderabad), chillies/cotton (Guntur), handloom (Pochampally/Uppada), seafood processing (Visakhapatnam).

**Malayalam (മലയാളം):** Script U+0D00–U+0D7F. Key sectors: Tourism (all Kerala), cashew (Kollam), spices (Idukki), coir (Alappuzha), gold jewellery (Thrissur), seafood (Kochi, Kozhikode). Largest NRI community — international billing is important.

---

## 4. The 18 Features — Master List and Build Priority

### Master Feature List

| # | Feature | Build Priority | Status |
|---|---|---|---|
| 1 | Universal Billing Engine | **Phase 1 — Core** | Build |
| 2 | Industry Templates Engine | Phase 1 core + Phase 2 + Phase 3 expansion | Build |
| 3 | Multi-Branch (LAN only) | Phase 3 — after 1,000 active users | Do not build yet |
| 4 | Elegant UI | **Phase 1 — Core** | Build |
| 5 | Profit / Margin Intelligence | **Phase 1 — Core** | Build |
| 6 | Inventory Intelligence (slow/dead stock) | **Phase 1 — Core** | Build |
| 7 | Size / Colour / Variant Inventory | Phase 1 for Clothing template; Phase 2 full | Build |
| 8 | Construction / Plumbing / Electrical / Paint templates | **Phase 1 — Core** | Build |
| 9 | Attendance Module | Phase 2 | Build later |
| 10 | Chrome Extension | **NEVER** | Permanently rejected |
| 11 | About Aszurex + Support Page | **Phase 1 — Core** | Build |
| 12 | Test Coverage (80%+) | **Phase 1 — Core, continuous** | Ongoing |
| 13 | Business Identity Everywhere | **Phase 1 — Core** | Build |
| 14 | Credit Tracking (aging, WhatsApp text) | **Phase 1 — Core** | Build |
| 15 | Legal Positioning Language Discipline | **Phase 1 — Core** | Enforce always |
| 16 | Wholesale / Distributor Features | Phase 2 | Build later |
| 17 | Multi-Language Support (6 languages) | **Phase 1 — ALL 6** | Build |
| 18 | Modular Industry Engine (36 templates total) | Phase 1 core + Phase 2 + Phase 3 | Build |

### Per the 18-Point Evaluation (Vishwas's own assessment)

**Must ship first:** 1, 4, 5, 6, 11, 12, 13, 14, 15, 17

**Build next:** 2, 7, 8, 9, 16

**Future (after user base):** 3, 18 (full specialist expansion)

**Reject permanently:** 10 (Chrome Extension)

---

## 5. Feature Deep Dives

### Feature 1: Universal Billing Engine ⭐ Phase 1 — Core

The bill is the moment of truth. If printing fails, if the format looks unprofessional, if tax math is wrong — users leave. Every other feature is secondary to getting this right.

**Document Types:**

| Document | Who Needs It | Key Fields |
|---|---|---|
| **Retail Invoice** | Shops, restaurants, quick service | Items, qty, price, total, payment method |
| **GST Tax Invoice** | Any GST-registered B2B seller | GSTIN both parties, HSN codes, CGST/SGST/IGST split |
| **Proforma Invoice** | Exporters, large B2B pre-orders | Same as GST invoice, marked "Proforma – Not for payment" |
| **Quotation / Estimate** | Contractors, service providers | Items, validity date, terms and conditions |
| **Purchase Invoice** | All businesses | Supplier details, ITC-eligible flag, batch/lot ref |
| **Credit Note** | Returns, overbilling corrections | Original invoice ref, reason, reversal amount |
| **Debit Note** | Underbilling corrections | Original invoice ref, additional charge reason |
| **Delivery Challan** | Textile, manufacturing, construction | Items dispatched, no tax |
| **Job Work Challan** | Textile, manufacturing | Fabric sent to job worker, ITC-04 compliant |
| **Advance Receipt** | Booking deposits | Customer, amount, purpose, adjustment pending |
| **Purchase Order** | Wholesale, manufacturing | Supplier, items, expected delivery, terms |

**Printer Support:**
```
PrintService (local only — no cloud)
├── ESC/POS Thermal     — electron-pos-printer npm
│   ├── 80mm (most common)   — Star TSP143, Epson TM-T82, RP80
│   ├── 58mm (compact)
│   └── 76mm (older models)
├── A4 System Print      — Electron webContents.print()
│   ├── Full branded invoice
│   ├── Condensed A5 (2-per-A4)
│   └── GST format
└── PDF Export (local)   — Electron webContents.printToPDF()
    └── Save to disk, open in system PDF viewer
```

**PDF decision (final):** `webContents.printToPDF()` — zero extra dependencies, uses bundled Chromium. Do NOT use html-pdf-node or puppeteer.

**Multi-language printing:** Invoice language follows the user's selected language. Business can print an invoice in Kannada, Tamil, or Hindi — everything in the locale JSON renders on the document. Font bundling (Section 8.4) makes this work offline.

**Custom invoice templates:** `InvoiceTemplate` config object controls layout, paper size, branding (logo, name, address, GSTIN, FSSAI no., drug licence no.), footer text, watermark, language, currency, bank details, UPI QR, T&C, "Powered by Sarang" footer.

**Currency and amounts:** Always store raw numbers in DB. Format at display time using `Intl.NumberFormat`. Never store formatted strings ("₹1,234") in DB.

---

### Feature 2: Industry Templates Engine ⭐ Phase 1 core + Phase 2 + Phase 3

**Architecture principle: One engine. Configuration drives behaviour. Zero code duplication.**

```typescript
interface IndustryTemplate {
  id: string
  nameKey: string                // i18n key
  icon: string                   // Lucide icon name
  enabledModules: ModuleId[]
  disabledModules: ModuleId[]
  inventoryModel: 'STANDARD' | 'VARIANT' | 'SERIAL' | 'BATCH_EXPIRY' | 'FABRIC_ROLL'
  billingTypes: BillingTypeId[]
  hsnPresets: { code: string; description: string; gstRate: number }[]
  customFields: CustomFieldDefinition[]
  reportPresets: ReportPresetId[]
  defaultUnits: string[]
  requiresFSSAI: boolean
  requiresDrugLicense: boolean
  requiresGSTIN: boolean
}
```

> **GST Rate Note:** All HSN/SAC rates in this document are as of June 2026. GST Council revises rates periodically. Run a rate audit every quarter — see Section 17.

---

### Phase 1 — Core Templates (Ship First)

#### 2A. Retail / General Store / Kirana
```yaml
modules_on: [billing, inventory, customers, expenses, payments, reports, notifications]
billing_types: [retail_invoice, gst_invoice, quotation, credit_note, purchase_invoice]
inventory_units: [pcs, kg, g, litre, ml, packet, box, dozen, carton, sachet]
default_categories: [Grocery, Beverages, Snacks, Household, Personal Care, Stationery]
hsn_presets:
  - 0402-0410: Dairy — 5% GST
  - 1001-1008: Cereals — 0% (unbranded), 5% (branded)
  - 2101-2106: Processed food — 5-18% GST
  - 3303-3307: Cosmetics — 18% GST
  - 9619: Sanitary pads — 0% GST
special_features: [barcode_scan, quick_billing_pos, day_close_report, upi_qr_display]
reports: [daily_sales, gst_summary, stock_report, payment_collection, top_selling_items]
```

#### 2B. Restaurant / Cafe / Dhaba / Food Service
```yaml
modules_on: [billing, inventory, customers, expenses, tables, kot, recipes, payments]
billing_types: [retail_invoice, gst_invoice, kot_print]
fssai_required: true
special_features:
  - table_management (floor plan, merge tables, split bills)
  - kot_printing (instant KOT to kitchen thermal printer on separate port)
  - kitchen_display_screen (KDS mode — full screen for kitchen TV/tablet)
  - dietary_tags (Veg GREEN / Non-Veg RED / Jain YELLOW — mandatory in India)
  - combo_pricing (meal deals, family packs)
  - recipe_costing (BOM per dish)
  - day_close (Z-report: cash + UPI + card totals, tips, voids)
  - advance_booking (deposit-based for events/parties)
  - delivery_tracking (Swiggy/Zomato reference reconciliation)
  - daily_production_estimate (7-day avg × 1.2 buffer)
hsn_presets:
  - 9963: Restaurant/food service — 5% GST
reports: [food_cost_report, item_wise_sales, table_occupancy, daily_z_report, waste_report]
```

#### 2C. Clothing / Garments Retail
```yaml
inventory_model: VARIANT  # Size × Colour matrix
size_options: [XS, S, M, L, XL, XXL, 3XL, 4XL, 26, 28, 30, 32, 34, 36, 38, 40, 42, custom]
colour_tracking: true
hsn_presets:
  - 6101-6106: Knitted garments — 5% if MRP ≤₹1000, 12% if >₹1000
  - 6201-6217: Woven garments — same split
  - 6401-6405: Footwear — 5% if ≤₹1000, 18% if >₹1000
special_features:
  - size_colour_matrix_billing (visual grid, click to add to bill)
  - tag_scanner (scan barcode → auto-fill item + size + colour + price)
  - exchange_management (return Size M, take Size L — credit note workflow)
  - season_discount (bulk markdown by category or style code)
  - unsold_stock_aging (which sizes/colours didn't move this season)
reports: [size_wise_stock, colour_wise_stock, slow_moving_styles, exchange_report]
```

#### 2D. Electronics / Mobile / Appliances Store
```yaml
inventory_model: SERIAL  # IMEI/serial per unit
hsn_presets:
  - 8517: Mobile phones — 18% GST
  - 8471: Laptops, tablets — 18% GST
  - 8509: Household appliances — 18% GST
  - 8504: Chargers, adapters — 18% GST
special_features:
  - imei_tracking (scan IMEI at purchase and sale)
  - warranty_management (brand + shop warranty, expiry alerts)
  - repair_job_cards (device in for repair, track status, bill on completion)
  - demo_stock_flag (excluded from stock report)
reports: [imei_ledger, warranty_due_report, repair_status_report]
```

#### 2E. Hardware Store / Building Materials (Feature 8 — Phase 1)
```yaml
billing_types: [gst_invoice, quotation, delivery_challan, credit_note, debit_note]
inventory_units: [kg, bag, sack, bundle, pcs, sq_ft, cu_ft, rmt, litre, tin, box, roll]
credit_sales: true  # udhar is the backbone of this business
hsn_presets:
  - 2523: Cement — 28% GST
  - 7214: Steel bars/rods — 18% GST
  - 3210: Paint — 18% GST
  - 3917: PVC pipes — 18% GST
  - 8544: Electrical wire — 18% GST
  - 6907: Ceramic tiles — 28% GST
  - 4418: Plywood — 18% GST
special_features:
  - bulk_pricing (rate per bag / per tonne — auto-convert)
  - credit_limit_enforcement (block sale when outstanding > credit_limit)
  - project_tagging (link purchases/sales to a construction project)
  - price_revision_log (cement/steel prices change monthly)
reports: [credit_aging, supplier_outstanding, project_wise_purchase, price_history]
```

#### 2F. Grocery / Supermarket / FMCG
```yaml
inventory_model: BATCH_EXPIRY
special_features:
  - expiry_alerts (7/15/30 days)
  - batch_tracking (lot number from supplier)
  - customer_loyalty_points (earn 1 point per ₹10, redeem at checkout)
  - barcode_scanner
  - supplier_rate_comparison
reports: [expiry_report, dead_stock_report, category_margin, supplier_comparison]
```

#### 2G. Plumbing / Sanitary Store (Feature 8 — Phase 1)
```yaml
inventory_units: [pcs, metre, rmt, set, box, bag]
special_features: [project_tagging, supplier_credit, bulk_pricing]
hsn_presets:
  - 3917: PVC pipes, fittings — 18% GST
  - 7307: Metal fittings (brass, iron) — 18% GST
  - 6910: Ceramic sanitaryware — 18% GST
  - 8481: Taps, valves — 18% GST
```

#### 2H. Electrical Store / Lighting Shop (Feature 8 — Phase 1)
```yaml
inventory_units: [pcs, coil, metre, set, box]
special_features: [warranty_management, project_tagging, brand_wise_stock]
hsn_presets:
  - 8539: LED bulbs, tubes — 12% GST
  - 8544: Wires, cables — 18% GST
  - 8536: Switches, sockets — 18% GST
  - 8504: Transformers, stabilizers — 18% GST
```

#### 2I. Paint Store (Feature 8 — Phase 1)
```yaml
# Paint stores have unique needs — shade mixing, tinting, project-based selling
inventory_units: [litre, kg, tin_1L, tin_4L, tin_10L, tin_20L, bucket]
special_features:
  - shade_catalogue (brand → base → shade code → shade name)
  - tinting_reference (base + toner ratio for custom shade — reference only)
  - project_tracking (contractor buys paint for specific site, track usage)
  - brand_comparison (Asian Paints vs Berger vs Nerolac — same shade, different rate)
  - contractor_credit (painters and contractors buy on credit)
  - empty_tin_tracking (customers return tins for exchange discount)
hsn_presets:
  - 3210: Paints, varnishes (water-based) — 18% GST
  - 3211: Prepared driers — 18% GST
  - 3212: Pigments, tinters — 18% GST
  - 3214: Putty, sealants, caulking — 18% GST
  - 3506: Adhesives (Fevicol, etc.) — 18% GST
reports: [brand_wise_sales, shade_movement_report, contractor_credit_aging]
```

#### 2J. Construction Materials / Distributor (Feature 8 — Phase 1)
```yaml
# Dedicated template for pure construction material distributors (cement, steel, aggregate)
# Different from Hardware (2E) — distributor sells to contractors, not end consumers
modules_on: [billing, inventory, customers, suppliers, credit_sales, purchase_orders, expenses]
billing_types: [gst_invoice, delivery_challan, purchase_invoice, credit_note, debit_note]
inventory_units: [bag, tonne, MT, cu_m, rmt, pcs]
special_features:
  - bulk_order_billing (5 trucks of cement = one invoice with multiple deliveries)
  - contractor_accounts (contractor credit lines with site-wise purchase tracking)
  - delivery_schedule (material delivery schedule per contractor per site)
  - rate_negotiation_log (contractor negotiated price vs MRP — log per deal)
  - grade_tracking (OPC 43 vs OPC 53, TMT Fe500 vs Fe550)
  - material_certificate_ref (test certificate reference per batch — for reference only)
hsn_presets:
  - 2523: Cement (OPC/PPC/PSC) — 28% GST
  - 7214: Steel bars (TMT) — 18% GST
  - 2517: Crushed stone, aggregate — 5% GST
  - 2505: Sand (natural) — 5% GST
  - 6810: Precast concrete products — 18% GST
```

---

### Phase 2 — Extended Templates

#### 2K. Pharmacy / Medical Store
```yaml
inventory_model: BATCH_EXPIRY
special_features: [expiry_alerts, batch_tracking, schedule_H_flag, narcotic_flag,
                   doctor_prescription_ref]
legal_disclaimer: |
  Sarang tracks stock and billing for pharmacy operations.
  It does NOT replace drug controller compliance software.
  Schedule H, H1, and X drugs require compliance per Drugs and Cosmetics Act 1940.
hsn_presets:
  - 3003/3004: Pharmaceutical formulations — 12% GST
  - 3005: Bandages, surgical dressings — 12% GST
  - 9018: Medical instruments/devices — 12% GST
```

#### 2L. Automobile / Two-Wheeler Workshop / Mobile Store
```yaml
# Mobile store billing is same structure as electronics (2D) — combine here
special_features:
  - job_card_management (vehicle in, diagnosis, parts + labour, vehicle out)
  - vehicle_history (all service records per vehicle by registration no.)
  - parts_inventory (auto-deduct parts used in a job card)
  - labour_charges_separate (parts vs labour split for GST)
  - service_due_reminders (WhatsApp text generated)
hsn_presets:
  - 8708: Auto parts — 28% GST
  - 4011: Tyres — 28% GST
  - 2710: Engine oil, lubricants — 18% GST
  - 9987: Vehicle repair service — 18% GST
```

#### 2M. Wholesale / Distributor (Feature 16 — Phase 2)
```yaml
# Generic wholesale — FMCG, grocery, household goods distribution
pricing_model: TIERED  # Retail / Wholesale / Sub-distributor price lists per product
special_features:
  - tiered_pricing (different price list per customer group)
  - van_billing (bill on delivery route, sync at day end)
  - beat_planning (area-wise delivery schedule)
  - multi_unit_pricing (Loose / Box / Carton — auto rate conversion)
  - salesman_management (customers assigned to salesman, collection tracking)
  - damage_claims (return + credit note for damaged goods)
  - route_collection_report (cash + credit collected per route per day)
```

#### 2N. Fish / Seafood / Meat Shop
```yaml
# Massive MSME segment — Kerala, coastal Karnataka, coastal AP/TN
# Daily price changes, perishable inventory, weight-based billing
inventory_model: STANDARD  # perishable — today's stock is fresh
inventory_units: [kg, g, piece, dozen, box, tray]
special_features:
  - daily_price_update (quick bulk rate update screen every morning)
  - species_catalogue (Pomfret, Surmai, Rohu, Prawns, Crab, Squid — each is a product)
  - weight_based_billing (enter weight → rate auto-calculates)
  - day_close_wastage (enter unsold qty at close — recorded as wastage loss)
  - supplier_purchase (daily purchase from fish market/auction)
  - daily_margin_summary (purchase cost vs sales revenue, per species)
fssai_required: true
hsn_presets:
  - 0301: Live fish — 0% GST
  - 0302: Fresh/chilled fish — 0% GST
  - 0303: Frozen fish — 5% GST
  - 0306: Crustaceans (prawns, crab, lobster) — 0% fresh; 5% frozen
  - 0307: Molluscs (squid, octopus) — 0% fresh; 5% frozen
  - 0207: Poultry meat — 0% fresh; 12% frozen/packaged
reports: [daily_sales_by_species, daily_margin, wastage_report, supplier_payment_summary]
```

#### 2O. Bakery / Patisserie / Cloud Kitchen / Catering
```yaml
special_features:
  - recipe_management (BOM per product — flour, sugar, eggs, etc.)
  - production_schedule (units to bake based on orders + avg demand)
  - advance_order_booking (deposit on booking, balance on delivery)
  - catering_order (event date, head count, menu, delivery address)
  - expiry_tracking (finished goods shelf life)
  - recipe_scaling (scale from 10 to 100 units, all ingredients auto-scale)
hsn_presets:
  - 1905: Baked goods — 5% fresh bread, 18% packaged biscuits
  - 9963: Catering services — 5% GST
```

#### 2P. Jewellery Store (Gold / Silver / Diamond / Gems)
```yaml
# Kerala priority — Thrissur is India's gold capital; large NRI jewellery buyers
inventory_model: SERIAL
inventory_units: [grams, carats, pcs]
special_features:
  - making_charges (flat per gram OR % of gold value — configurable)
  - hallmarking_number (HUID mandatory from 2021 for 14/18/22 carat gold)
  - old_gold_exchange (customer brings old gold, weigh, assess purity, apply as advance)
  - metal_rate_reference (today's gold/silver rate entered manually each morning)
  - stone_details (diamond: 4Cs — carat, cut, clarity, colour)
  - repair_job_cards (jewellery given for repair/sizing)
  - daily_gold_rate_log
hsn_presets:
  - 7108: Gold (unwrought) — 3% GST
  - 7113: Gold jewellery — 3% GST
  - 7102: Diamonds — 0.25% GST
  - 7106: Silver jewellery — 3% GST
legal_note: HUID mandatory for 14/18/22 carat gold. Sarang stores for records only.
```

#### 2Q. Dry Fruit & Spice Store (Retail)
```yaml
# Consumer retail — different from Wholesale (2AE)
# Walk-in customers buying 100g, 250g, 500g, 1kg quantities
# Festive sales (Diwali, Eid, Christmas gift packs) are a major revenue driver
inventory_units: [g, kg, pcs, box, tin, packet, pouch]
special_features:
  - weight_based_billing (sell 250g of cashews → rate per kg auto-calculates)
  - grade_tracking (Premium / Standard / Economy for same item)
  - origin_display (Kashmir walnut, California almond, Turkey fig, Guntur chilli)
  - mixed_pack_builder (assorted dry fruit gift pack — multiple items, one sale price)
  - freshness_date_reference (roasted today / packed this week — for shop display reference)
  - festive_pack_pricing (Diwali/Eid/Christmas special combo pricing — seasonal)
  - bulk_discount (buy 500g at better rate than 250g — auto-apply at billing)
  - display_stock (front display qty vs backroom stock — separate tracking)
  - supplier_lot_tracking (batch from which supplier/origin for each item)
hsn_presets:
  # Dry Fruits
  - 0801.11: Coconuts — 0% GST
  - 0801.31: Cashews (raw) — 5% GST
  - 0801.32: Cashews (shelled/processed) — 5% GST
  - 0802.11: Almonds (in shell) — 0% GST
  - 0802.12: Almonds (shelled) — 12% GST
  - 0802.31: Walnuts (in shell) — 0% GST
  - 0802.32: Walnuts (shelled) — 12% GST
  - 0802.51: Pistachios (in shell) — 0% GST
  - 0802.52: Pistachios (shelled) — 12% GST
  - 0802.61: Macadamia nuts — 12% GST
  - 0804.10: Dates (fresh/dried) — 0% GST
  - 0804.20: Figs (dried) — 12% GST
  - 0804.30: Pineapples — 0% GST
  - 0806.20: Dried grapes (raisins, sultanas) — 5% GST
  - 0813.10: Dried apricots — 12% GST
  - 0813.20: Prunes (dried plums) — 12% GST
  - 0813.50: Mixed nuts (processed/roasted, branded) — 12% GST
  # Spices (whole and ground)
  - 0904.11: Pepper (whole) — 5% GST
  - 0904.12: Pepper (crushed/ground) — 5% GST
  - 0904.21: Chillies (whole dried) — 5% GST
  - 0904.22: Chillies (crushed/ground) — 5% GST
  - 0905.10: Vanilla beans — 5% GST
  - 0906.11: Cinnamon (whole) — 5% GST
  - 0906.12: Cinnamon (ground) — 5% GST
  - 0907.10: Cloves (whole) — 5% GST
  - 0908.11: Nutmeg (whole) — 5% GST
  - 0908.21: Mace — 5% GST
  - 0908.31: Cardamom (green) — 5% GST
  - 0909.21: Cumin seeds — 5% GST
  - 0909.61: Fennel seeds — 5% GST
  - 0909.62: Fenugreek seeds — 5% GST
  - 0910.11: Ginger (dried) — 5% GST
  - 0910.30: Turmeric (whole/ground) — 5% GST
  - 0910.91: Thyme, saffron, bay leaves, curry leaves — 5% GST
  - 0910.99: Mixed spice blends (branded masala) — 5% GST
  # Processed/packaged (brand matters for GST)
  - 2103.90: Sauces, condiments, curry powder (branded) — 12% GST
  - 2106.90: Food preparations (roasted seeds, trail mixes, branded snacks) — 18% GST
legal_note: |
  FSSAI licence is required for food retail businesses above applicable threshold.
  Pre-packaged dry fruits and spices sold with brand name attract applicable GST.
  Unbranded, loose spices sold in small quantities may attract lower or nil GST.
  Consult your CA for the applicable rate for your specific products and packaging.
reports: [daily_sales_by_item, grade_wise_stock, festive_pack_sales, supplier_lot_report,
          low_stock_alert, weight_variance_report]
```

#### 2R. Salon / Spa / Beauty Parlour / Barber Shop
```yaml
special_features:
  - appointment_booking (time slots per staff member per day)
  - service_catalogue (fixed price services)
  - staff_commission (% of service value to stylist)
  - loyalty_points (earn and redeem)
  - package_deals (buy 5 facials, get 1 free — track redemptions)
hsn_presets:
  - 9602: Hair services — 18% GST
  - 9603: Beauty/cosmetic services — 18% GST
```

#### 2S. Hotel / Lodge / Guest House / Homestay
```yaml
special_features:
  - room_management (room type, rack rate, occupancy status)
  - check_in_out (guest registration, check-in/out time)
  - folio_management (room + restaurant + laundry on one bill at checkout)
  - gst_on_accommodation (0% for <₹1000/night, 12% for ₹1000-7500, 18% for >₹7500)
  - police_c_form (Form-C reference for foreign guests)
legal_note: Police intimation (C-form) is the hotel's legal responsibility.
```

#### 2T. Agricultural Inputs / Seeds / Fertilizer Store
```yaml
inventory_units: [kg, bag, litre, pcs, packet, bottle]
hsn_presets:
  - 3101-3105: Fertilizers — 0% or 5% GST (varies by type)
  - 3808: Pesticides — 18% GST
  - 1209: Seeds — 0% GST
legal_note: Sale of fertilizers and pesticides requires valid dealer licence.
```

#### 2U. Real Estate Agent / Property Broker
```yaml
special_features: [property_listing, deal_tracking, commission_calculator, document_checklist]
hsn_presets:
  - 9972: Real estate brokerage services — 18% GST
legal_note: RERA registration is the agent's responsibility.
```

#### 2V. Tailoring / Boutique / Custom Clothing
```yaml
special_features:
  - measurement_profiles (per customer: chest, waist, hip, sleeve, inseam, etc.)
  - order_tracking (blouse in progress, trouser ready, kurta pending)
  - fabric_register (customer's own fabric received — account for wastage)
  - advance_deposit (50% advance on order, balance on delivery)
hsn_presets:
  - 9988: Job work / Tailoring services — 5% GST
```

#### 2W. Printing Press / Stationery / Packaging
```yaml
special_features:
  - job_order_management (paper type, size, qty, colours, binding)
  - paper_stock_management (paper types × GSM × size)
  - plate_charges_separate (one-time design vs per-unit printing)
hsn_presets:
  - 9989: Printing services — 18% GST
  - 4820: Registers, notebooks — 12% GST
```

#### 2X. Gym / Fitness Center / Yoga Studio
```yaml
special_features:
  - membership_management (monthly/quarterly/annual, renewal tracking)
  - renewal_alerts (members expiring in 7 days)
  - personal_training_sessions (PT session package, track usage)
hsn_presets:
  - 9996: Sports and recreational services — 18% GST
```

#### 2Y. Optician / Spectacles / Eye Care
```yaml
inventory_model: SERIAL
special_features:
  - prescription_capture (RE/LE SPH/CYL/AXIS/ADD — for reference only)
  - lens_job_card (frame + prescription → job sent to lens lab → ready for collection)
  - warranty_management (frame warranty)
hsn_presets:
  - 9003: Spectacle frames — 18% GST
  - 9001: Optical lenses — 12% GST
```

#### 2Z. Timber / Wood / Plywood Merchant
```yaml
inventory_units: [cubic_feet, cubic_metre, sq_ft, running_metre, pcs, bundle]
special_features:
  - cubic_feet_calculator (length × width × thickness → cubic feet)
  - species_tracking (teak, pine, sal, eucalyptus)
  - forest_permit_ref (permit number for legal compliance)
legal_note: CITES-listed species require permits. Sarang records for reference only.
hsn_presets:
  - 4407: Sawn timber — 12% GST
  - 4412: Plywood — 18% GST
```

---

### Phase 3 — Specialist Templates (Full Modules)

#### 2AA. Textile Manufacturer / Garment Exporter
*(Full specification in Section 6.2 — Kapda framework)*

#### 2AB. Construction Contractor — Small/Mid-Sized
*(Full specification in Section 6.3 — Makan framework)*

#### 2AC. Petrol Pump / Fuel Station
```yaml
special_features:
  - shift_management (shift A/B/C per nozzle per day)
  - meter_reading (opening/closing DIP reading per nozzle)
  - tank_reconciliation (DIP chart based stock vs meter sales)
  - credit_customers (fleet accounts on credit)
  - daily_dsr (Daily Summary Report)
legal_note: Petrol/diesel are outside GST. State VAT applies.
```

#### 2AD. School / Coaching Centre / Tuition
```yaml
modules_on: [billing, students, batches, fees, attendance, expenses, payments, reports]
special_features:
  - student_management (name, grade, batch, parent contact, fee plan)
  - batch_schedule (subject × timing × faculty)
  - fee_collection (monthly/quarterly/annual, track dues per student)
  - fee_reminder_text (copy-paste WhatsApp reminder)
  - attendance_register (per batch, per date)
hsn_presets:
  - 9992: Education services — 0% GST (most coaching services exempt)
legal_note: GST exemption conditions vary. Consult your CA.
```

#### 2AE. Clinic / Ayurvedic Centre / Medical Practice
```yaml
special_features:
  - patient_management (name, age, contact, medical record number — reference only)
  - appointment_scheduling (doctor × time slot)
  - consultation_billing (consultation fee + medicines + procedures)
  - daily_opd_summary (patients count + revenue per day)
hsn_presets:
  - 9993: Healthcare services — 0% GST (most clinical services exempt)
  - 3003: Ayurvedic medicines (classical) — 12% GST
legal_note: Sarang is a billing tool — not a certified EMR system. Clinical authority is with the registered practitioner.
```

#### 2AF. Coffee Estate / Curing Works (Karnataka Specialty)
```yaml
inventory_units: [kg, tonne, bag, sack]
special_features:
  - cherry_procurement (buy cherry from smallholder farmers — rate per kg)
  - lot_tracking (lot number → source estate → processing date → grade)
  - grade_management (AA, AB, PB, C — Indian grading system)
  - curing_process_log (cherry → pulped → fermented → dried → parchment → hulled → graded)
  - export_billing (in USD)
hsn_presets:
  - 0901.11: Green coffee (not roasted) — 0% GST
  - 0901.21: Roasted coffee — 5% GST
legal_note: Coffee Board of India registration required above threshold. Export under FSSAI and APEDA compliance.
```

#### 2AG. Silk Weaving / Handloom (Karnataka / Tamil Nadu Specialty)
```yaml
inventory_units: [metres, kg, gram, pieces, rolls]
special_features:
  - yarn_procurement (warp × weft per design)
  - design_code_tracking (each saree design has a unique code)
  - weaver_job_work (yarn given to weaver → challan → saree received back)
  - quality_grading (GI-tagged Mysore Silk vs non-GI, A/B/C grade)
  - export_billing (in USD/EUR)
hsn_presets:
  - 5007: Woven fabrics of silk — 5% GST
  - 7114: Zari (real gold/silver) — 3% GST
legal_note: Mysore Silk GI protection — "Mysore Silk" branding requires KSIC certification.
```

#### 2AH. Produce Trading / Agricultural Mandi (North India)
```yaml
# UP, Punjab, Haryana, AP — commission agent model, APMC regulated
special_features:
  - commission_agent_model (trader earns % of sale value, not markup)
  - lot_based_trading (a lot = entire consignment from one farmer)
  - principal_tracking (multiple farmers whose produce the trader sells on behalf)
  - mandi_tax_reference (APMC/mandi fee tracking — separate from GST)
  - commodity_price_log (daily price of chilli, onion, tomato, wheat)
  - apmc_licence_ref (licence number + expiry reminder)
hsn_presets:
  - 0701-0714: Vegetables — 0% GST
  - 0801-0814: Fruits and nuts — 0% GST
  - 1001-1008: Cereals — 0% GST
  - 0904-0910: Spices — 5% GST
legal_note: APMC regulations are state-specific. Mandi tax/cess is a state levy separate from GST.
```

#### 2AI. Cold Storage / Ice Plant
```yaml
# Kerala fish supply chain, coastal AP prawn processing, agri produce
special_features:
  - storage_allotment (customer → chamber → shelf → date in/out)
  - chamber_management (-18°C frozen vs 2-4°C chilled)
  - in_out_register (daily log per customer)
  - storage_billing (charge per MT per day or per month)
  - ice_production_log (tonnes per day vs capacity)
  - ice_sales_billing (sell ice by weight — daily rate)
hsn_presets:
  - 9967: Cold storage (agri produce) — 0% GST
  - 9967: Cold storage (non-agri) — 18% GST
  - 2201: Ice (manufactured) — 18% GST
legal_note: FSSAI compliance and temperature records for food cold storage are the operator's responsibility.
```

#### 2AJ. Travel Agency / Tour Operator (Kerala / Tourism States)
```yaml
special_features:
  - package_management (itinerary, inclusions, pax count, date)
  - package_billing (consolidated invoice per group)
  - vendor_tracking (hotels, transport, guides — pay separately, bill together)
  - advance_deposit (partial on booking, balance before travel)
  - foreign_tourist_billing (in USD/EUR)
hsn_presets:
  - 9985: Tour operator services — 5% GST (no ITC) or 18% (with ITC)
legal_note: GST on tour packages has two options — consult CA for correct treatment.
```

#### 2AK. Dhaba / Highway Restaurant / Thali Joint
```yaml
# Different from Restaurant (2B) — no table management, bulk production, cash-heavy
special_features:
  - thali_counter_billing (fixed price, unlimited refills — no per-item billing)
  - bulk_production_mode (cook in batches — 50 rotis, 20 kg dal — not per portion)
  - shift_management (shift A/B for cooks and servers)
  - daily_production_estimate
fssai_required: true
hsn_presets:
  - 9963: Food service — 5% GST
```

#### 2AL. Spice / Dry Fruit Wholesale (North India / AP)
```yaml
# Khari Baoli (Delhi), Jodhpur, Guntur chilli market — high-value wholesale
# Different from Retail Store (2Q) — bulk selling to retailers and restaurants
inventory_units: [kg, g, tonne, quintal, bag, box, tin]
special_features:
  - grade_tracking (Grade 1/2/3 for same spice)
  - origin_tracking (Guntur chilli vs Byadgi chilli vs Kashmiri — different price)
  - bulk_repacking (buy in sacks, repack in 100g/500g pouches — track conversion)
  - moisture_content_reference
  - seasonal_price_log
  - credit_sales (wholesale = 30-60 day credit cycle)
hsn_presets: (same as 2Q — full spice and dry fruit HSN preset list)
```

#### 2AM. Handicraft / Artisan Workshop (Rajasthan, UP, Karnataka)
```yaml
# Moradabad brass, Jaipur gems, Varanasi silk, Channapatna toys, Bidriware
special_features:
  - artisan_job_cards (work given to artisan, expected completion, qty)
  - design_catalogue (design code, material BOM)
  - export_billing (USD/EUR for international buyers)
  - gi_tag_reference (GI tag number if product has GI protection)
  - piece_rate_tracking (artisan payment per piece — reference for wages)
hsn_presets:
  - 8306: Bells, gongs, statuettes, trophies (brass/metal) — 18% GST
  - 9701: Paintings (hand-made) — 12% GST
legal_note: GI tags are legally protected. Only use GI claims on genuinely qualified products.
```

---

### Feature 3: Multi-Branch — Phase 3, LAN ONLY

**Do not build until 1,000+ single-location active users.**

**LAN sync architecture:** SQLite WAL mode + mDNS peer discovery + Last-Write-Wins with device UUID + millisecond timestamp. Manual sync — user clicks "Sync with branches" when on local network. No internet required.

---

### Feature 4: Elegant UI ⭐ Phase 1 — Core

**Sarang-specific principles:**
1. **1366×768 first** — most common laptop resolution in Tier 2/3 India. 44px minimum tap target.
2. **Elderly-owner usable** — 3-step billing: select customer → add items → print. No jargon.
3. **10-minute onboarding** — wizard → business details → first product → first bill. Time this.
4. **Visible keyboard shortcuts** — `Ctrl+N` new bill, `Ctrl+P` print, `Ctrl+F` search. Show in UI.
5. **Status-first dashboard** — today's sales, cash in hand, reorder alerts, pending receivables. Numbers not charts.
6. **Plain error messages** — "A product with this barcode already exists." Not "SQLITE_CONSTRAINT_UNIQUE."
7. **Devanagari numeral toggle** — settings option to show prices in Hindi numerals (१,२३,४५६).
8. **Script-appropriate fonts** — Noto Sans bundled for all 5 Indian scripts.
9. **Dark mode** — already built. South Indian shop owners often work in dimly lit shops.
10. **Large touch-friendly buttons** — designed for both mouse and touchscreen (Windows tablet support).

**Design references:** Linear.app (information density), Stripe Dashboard (scannable tables), Notion (progressive disclosure), Shadcn/ui (composable components).

---

### Feature 5: Profit/Margin Intelligence ⭐ Phase 1 — Core

```
Business Summary Engine (NOT "P&L" — legal reasons)
├── Per-product gross margin % (cost_price vs selling_price)
├── RED warning: selling_price < cost_price on product card
├── Category-level margin summary
├── Daily business summary (sales − COGS − today's expenses)
├── Dead margin report (products < 5% margin, configurable threshold)
└── Top 10 / Bottom 10 margin products

NOT built (accounting territory):
- Net profit (needs depreciation, loan interest)
- Tax liability calculation
- Balance sheet
```

**Disclaimer on every summary screen:**
> "Estimated operational summary for internal reference only. Does not account for depreciation, loan interest, or tax liabilities. Consult a Chartered Accountant for certified financial statements."

---

### Feature 6: Inventory Intelligence ⭐ Phase 1 — Core

| Metric | Calculation | Action |
|---|---|---|
| Fast Moving | Sold > X units in last 30 days | Highlight, prioritise reorder |
| Slow Moving | Sold < Y units in last 90 days | Flag for review |
| Dead Stock | Zero sales in last 180 days | Alert, suggest clearance |
| Overstocked | Qty > 6 months avg demand | Capital lock-up warning |
| Below Reorder | Qty < reorder_level | Reorder notification |
| Near Expiry | expiry_date < today + 30 days | Urgent alert |

All thresholds configurable per industry. A jewellery shop's slow-moving (6 months) ≠ a grocery store's (1 week).

---

### Feature 7: Size/Colour/Variant Inventory ⭐ Phase 1 for Clothing; Phase 2 full

```
Product (parent — "Men's Formal Shirt")
└── ProductVariant { id, productId, size, colour, material?,
                     sku, barcode?, costPrice, sellingPrice,
                     inventory: { quantity } }
```

**Size matrix on billing screen:** Visual grid (sizes × stock qty). Click a cell → adds variant to bill. Zero-stock cells greyed and unclickable.

---

### Feature 8: Construction / Plumbing / Electrical / Paint ⭐ Phase 1 — Core

Covered by Templates 2E (Hardware), 2G (Plumbing), 2H (Electrical), 2I (Paint), 2J (Construction Materials Distributor) — all Phase 1. Full construction contractor workflow (BOQ, RA bills, muster roll) is Phase 3 specialist module under Template 2AB.

---

### Feature 9: Attendance Module — Phase 2

```typescript
Employee { id, name, phone, designation, joiningDate,
           employmentType: 'DAILY' | 'MONTHLY',
           dailyWage?: number, monthlySalary?: number }
Attendance { id, employeeId, date, projectId?,
             status: 'PRESENT' | 'ABSENT' | 'HALF' | 'LEAVE' | 'HOLIDAY',
             overtimeHours?: number }
```

Display salary reference only. Never calculate PF/ESIC/PT deductions. Construction site integration: labour cost per project visible in site P&L reference.

---

### Feature 10: Chrome Extension — PERMANENTLY REJECTED

No justification exists. Rejected. Do not revisit.

---

### Feature 11: About Aszurex + Support Page ⭐ Phase 1 — Core

```
About Sarang
├── What is Sarang? (2 sentences — no jargon)
├── Why is it free? (Vishwas's founder note — personal, 150 words max)
├── Privacy Promise ("we can't breach your data because we never have it")
├── About Aszurex
├── Support This Project
│   ├── UPI QR (generated locally — no network call)
│   └── "Tell a business owner" (copies clipboard text)
└── Contact: contact@aszurex.com | aszurex.com | WhatsApp
```

**Founder note draft:**
> "I'm Vishwas, founder of Aszurex. I'm from Karnataka. I watched neighbours and family friends — running shops, garment units, small construction businesses — struggle with software that was too expensive, too complicated, or taking their data to servers they never agreed to. Your business data belongs to you. Not to us. Not to any server. Sarang runs entirely on your computer. We see nothing. We have nothing. Sarang is free because trust is built through giving, not gating. — Vishwas, Aszurex"

---

### Feature 12: Testing — Continuous ⭐ Phase 1, 80%+ coverage target

| Build Phase | Target Tests | Coverage | Priority Areas |
|---|---|---|---|
| Phase 1 | 200+ | ~70% | All service logic, validation rules, every error code |
| Phase 2 | 350+ | ~80% | Variant inventory, industry templates, new modules |
| Phase 3 | 500+ | ~85% | IPC handlers, multi-branch sync, performance |

**Gaps to fill:** billing.service createInvoice, payment.service, tax calculation math (CGST/SGST/IGST), export service, settings service, backup/restore cycle.

---

### Feature 13: Business Identity Everywhere ⭐ Phase 1 — Core

```
BusinessProfile → Login screen | Dashboard header | Every invoice/document header |
                  Every report header | Window title bar: "Sarang — [BusinessName]"
```

**Setup wizard fields:** business name + logo, industry type, language, currency, GST status + GSTIN, state (CGST/SGST vs IGST logic), financial year start, date format.

---

### Feature 14: Credit Tracking ⭐ Phase 1 — Core

**What to build:**
1. Credit limit enforcement at billing — block sale if `outstanding > credit_limit`, clear message shown
2. Aging report (0-30d / 31-60d / 61-90d / 90+d buckets per customer)
3. WhatsApp reminder text generator (no API — user copies manually)
4. Supplier credit tracking (what we owe, aging)
5. Recovery dashboard (total receivable, due this week, overdue 30+d)

---

### Feature 15: Legal Language Discipline ⭐ Phase 1, enforced always

| Never Say | Say Instead |
|---|---|
| Profit & Loss | Business Summary |
| Balance Sheet | (don't show at all) |
| Tax Compliance | Tax Breakdown (Reference) |
| GST Return | GST Summary (for reference only) |
| Audit Ready | (never use) |
| CA Approved / GSTN Certified | (never) |
| Salary Slip | Salary Reference Sheet |
| Net Profit | Estimated Operational Surplus |

Enforced in code reviews. Any PR introducing prohibited terminology is rejected.

---

### Feature 16: Wholesale / Distributor Focus ⭐ Phase 2

A distributor does 10× the transaction volume of a retail shop. Getting one distributor on Sarang equals 10 retail shops.

**Core needs:** tiered pricing per customer group, van/route billing, beat planning, multi-unit conversion (loose/carton/master), salesman tracking, damage/shortage claims, route collection report.

---

### Feature 17: Multi-Language Support ⭐ Phase 1 — ALL 8

See Section 3 for full architecture and translation ownership.

**Hindi + Kannada + Tamil + Telugu + Malayalam + Marathi + Gujarati ship first. No excuses. No deferrals.**

Architecture supports unlimited future languages — locale files are pluggable JSON; adding a new language is adding a new folder.

---

### Feature 18: Modular Industry Engine ⭐ Phase 1 architecture, built across all phases

One core engine. 39 industry templates. Zero code duplication.

**Phase 1 — Core (10 templates):** Retail (2A), Restaurant (2B), Clothing (2C), Electronics (2D), Hardware (2E), Grocery (2F), Plumbing (2G), Electrical (2H), Paint (2I), Construction Materials Distributor (2J)

**Phase 2 — Extended (16 templates):** Pharmacy (2K), Auto Workshop/Mobile Store (2L), Wholesale/Distributor (2M), Fish/Seafood/Meat (2N), Bakery (2O), Jewellery (2P), **Dry Fruit & Spice Retail (2Q)**, Salon (2R), Hotel (2S), Agricultural Inputs (2T), Real Estate (2U), Tailoring (2V), Printing Press (2W), Gym (2X), Optician (2Y), Timber (2Z)

**Phase 3 — Specialist (13 named + up to 3 from field research):** Textile Manufacturer (2AA), Construction Contractor (2AB), Petrol Pump (2AC), School/Coaching (2AD), Clinic/Ayurvedic (2AE), Coffee Estate (2AF), Silk Weaving (2AG), Produce/Mandi (2AH), Cold Storage (2AI), Travel Agency (2AJ), Dhaba (2AK), Spice/Dry Fruit Wholesale (2AL), Handicraft Workshop (2AM)

**Named total: 39 industry templates.** Phase 3 may expand to 42 based on MSME owner interview findings before Phase 3 begins.

---

## 6. The Roti, Kapda, Makan Framework

### 6.1 ROTI (Food) — Built, Needs Polish

**What's built:** Restaurant KOT, table management, recipe module, daily close, food cost report.

**Critical gaps (must fix in Phase 1 polish):**
- Dietary tags per item (Veg GREEN / Non-Veg RED / Jain YELLOW) — mandatory in India
- Combo/meal deal pricing engine
- Kitchen Display Screen (KDS) mode — full-screen for kitchen TV/tablet
- Daily production estimate (7-day average × 1.2 buffer)
- Advance booking with deposit for events/parties
- Swiggy/Zomato order reference tracking

**Food industry coverage across templates:** Restaurant (2B), Grocery (2F), Bakery (2O), Fish/Seafood (2N), Dhaba (2AK) — complete ecosystem.

### 6.2 KAPDA (Textile) — Phase 3 Full Module

**Market size:** $174B (2024) → $350B by 2030 | 45 million employed | 80%+ MSMEs

**Three layers:**
- **Layer 1 — Retail Garment Shop:** Template 2C (Phase 1)
- **Layer 2 — Textile Wholesaler:** Template 2M (Phase 2)
- **Layer 3 — Textile Manufacturer / Garment Exporter:** Template 2AA (Phase 3)

**Layer 3 Production Workflow:**
```
Fabric Purchase → Fabric Store → Cutting Plan → Job Work Challan (to stitcher)
→ Quality Check → Finishing → Stock → Sale/Export

Key documents:
1. Job Work Challan (ITC-04) — fabric sent to stitcher + return challan
2. Cutting Plan — style/design code, fabric per piece, wastage %
3. Export Invoice — USD/EUR, FOB/CIF/EXW, HSN chapters 50-64, LC reference
```

**HSN Codes — Textile (as of June 2026):**
```
Chapter 50: Silk               — 5% GST
Chapter 52: Cotton             — 5% GST (yarn/fabric)
Chapter 54: Synthetic filament — 12% GST
Chapter 60: Knitted fabrics    — 5% GST
Chapter 61: Knitted garments   — 5% if MRP ≤₹1,000 / 12% if >₹1,000
Chapter 62: Woven garments     — same 5%/12% split
Chapter 64: Footwear           — 5% if ≤₹1,000, 18% if >₹1,000
Job Work: 9988 — 5% GST
Thread: 5402/5204 — 12% GST | Zipper, buttons: 9606/9607 — 18% GST
```

Karnataka-specific: Silk Weaving (2AG) for Mysuru/Ramanagara silk. Coffee Estate (2AF) for Kodagu/Chikkamagaluru.

### 6.3 MAKAN (Construction) — Phase 3 Full Module

**Market reality:**
- India construction sector: ₹6.34 trillion (2025), CAGR 8.1%
- Small contractors (₹50L–₹5Cr revenue): 2+ million in India
- Existing software: all cloud, all expensive, all complex — no good option for a contractor in Belgaum or Tirunelveli

**Five modules in Template 2AB:**

**Module 1 — BOQ (Bill of Quantities):**
```
Project: BBMP Road Widening
BOQ Item           | Unit  | Rate (₹) | Qty | Amount (₹)
Excavation         | Cu.m  |    150   | 500 | 75,000
PCC 1:4:8          | Cu.m  |  4,200   | 120 | 5,04,000
CC Pavement M40    | Cu.m  |  7,500   | 200 | 15,00,000
```

**Module 2 — RA Bills (Running Account):**
```
Gross RA Bill:      ₹4,99,800  |  Less Retention 10%:  -₹49,980
Less Advance:      -₹1,00,000  |  NET DUE:             ₹2,99,820
GST 9954 @18%:       ₹53,967  |  TOTAL INVOICE:       ₹3,53,787
```

**Module 3 — Daily Muster Roll** (labour attendance per site, trade-wise)

**Module 4 — Material Procurement per Site** (BOQ qty vs purchased vs used vs on-site)

**Module 5 — Site P&L Reference** (labelled: "Reference estimate only. Not a certified P&L.")

**HSN/SAC (as of June 2026):**
```
9954: Residential construction   — 12% GST
9954: Commercial/civil works     — 18% GST
2523: Cement (composite supply)  — 28% GST on material
7214: Steel (composite supply)   — 18% GST on material
```

**What NOT to build:** CAD/BIM, Gantt charts, CPM scheduling, equipment depreciation.

---

## 7. Marketing Engine — How Sarang Builds Aszurex

**The flywheel:**
```
User downloads Sarang free (anywhere in the world)
        ↓
Uses it daily for 3–6 months, data is on their machine
        ↓
Business grows → needs customisation / multi-branch / integration / data migration
        ↓
Contacts Aszurex
        ↓
Aszurex delivers paid implementation, customisation, data migration, support
```

**Distribution channels (ranked by effort vs return):**

| Channel | Effort | Return | Timeline |
|---|---|---|---|
| Invoice footer "Powered by Sarang" | Zero | High | Immediate |
| YouTube — Kannada + Hindi tutorials | Medium | Very High | 6 months |
| CA/Accountant partnership programme | Medium | Very High | 3 months |
| WhatsApp group distribution | Low | Medium | 1 month |
| GitHub open source | High | Long-term credibility | 12 months |
| Local computer/printer shops | Medium | Medium | 6 months |
| Android companion app (read-only) | High | Very High | 9 months |
| Karnataka MSME / KIADB events | Medium | Brand building | 6 months |

**Kannada-first YouTube:** "Sarang business software Kannada" — nearly zero competition. Target Bangalore, Mysuru, Hubli business owner searches. First 3 videos: Kirana store, Restaurant, Hardware store.

**CA Partner Programme:** Co-branded Sarang with CA's name. Client data never flows to CA — client exports reports, shares manually. CA gets Aszurex priority support + consultation voucher for clients.

**Invoice footer math:** 50 invoices/day × 365 days × 1,000 businesses = **18.25 million impressions/year, zero spend.**

---

## 8. Technical Debt and Architecture Risks

### 8.1 E-invoice (IRN) — Threshold Trap

Users crossing ₹5 crore need IRN generation.

**Safe approach (Aszurex never in data path):**
1. User registers with GSP (Karza, Masters India, Clear, etc.) directly
2. User enters their GSP API credentials in Sarang settings (AES-256 encrypted in electron-store)
3. Sarang formats the JSON payload per IRP schema — locally
4. Sarang calls GSP API directly from user's machine using user's own credentials
5. IRN + QR code returned, stored in local DB, printed on invoice

**Disclaimer:** "E-invoice uses your GSP credentials stored on your device. Aszurex does not process or receive any invoice data."

### 8.2 Sustainability — The "Free" Risk

**Mitigation stack:**
- UPI donations (low friction, high signal)
- Aszurex implementation/customisation services (the real revenue)
- Sarang Pro tier

**Sarang Pro — Formal Definition:**
- **Pricing:** ₹2,499/year or ₹9,999 lifetime (one-time, per installation)
- **Delivery:** Activation key entered in-app — no cloud account, no login, no phone home
- **Pro-only features:** Custom report builder, API access (local REST, no cloud), more than 5 user roles, priority support SLA, white-labelled Sarang for resellers, Sarang CA Partner Edition
- **Free tier guarantee:** Core billing, inventory, reports, 5 roles, 10 Phase 1 templates — free forever, no feature degradation ever

### 8.3 Schema Migrations for Production

Switch from `prisma db push` to `prisma migrate deploy` with migration history files. Auto-run on startup. Never use `--accept-data-loss`. Test migration from every prior version.

### 8.4 The Font Problem

Bundle Noto Sans for all Indian scripts inside the Electron package:
```
assets/fonts/
├── NotoSans-Regular.ttf + Bold (Latin)
├── NotoSansKannada-Regular.ttf + Bold   # must bundle
├── NotoSansTamil-Regular.ttf + Bold     # must bundle
├── NotoSansTelugu-Regular.ttf + Bold    # must bundle
├── NotoSansMalayalam-Regular.ttf + Bold # must bundle
└── NotoSansDevanagari-Regular.ttf + Bold # for Hindi
```
Adds ~12MB to installer. Non-negotiable for correct rendering.

### 8.5 SQLite WAL Mode and Startup Integrity

On every startup before any DB access:
```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA integrity_check;  -- if not 'ok': show error + offer backup restore
```

### 8.6 Application Logging (Local Only — Never Transmitted)

```
Log location: %APPDATA%/Sarang/logs/sarang-YYYY-MM-DD.log
Log levels:   ERROR + WARN only in production
Retention:    Auto-delete logs older than 7 days
Max size:     5MB per file, then rotate
```

On crash: show friendly error screen + **"Copy Error Details"** button. User pastes into GitHub Issue or WhatsApp. Never auto-transmit.

**Never log:** Any user data (customer names, amounts, product names, invoice content). Redact username from file paths.

### 8.7 Android Companion App (Phase 2 — Read-Only)

The goal is NOT a mobile billing app. It is an owner's dashboard — glance at today's numbers from your phone while you're away from the shop.

**What it shows (read-only, no data entry):**
```
Home Screen
├── Today's Sales (₹ total)
├── Today's Collections (cash received)
├── Pending Receivables (top 5 overdue customers)
├── Low Stock Alerts (items below reorder level)
└── Quick Actions
    ├── WhatsApp Payment Reminder (tap → opens WhatsApp with pre-filled text)
    └── Call Customer (tap phone number)

Reports (view only)
├── Last 7 days sales chart
├── Top 10 selling items this week
└── Outstanding customer list
```

**What it does NOT do:**
- No billing or invoice creation (billing needs keyboard + printer — mobile is wrong for this)
- No product/customer/supplier management
- No data entry of any kind
- No camera/barcode scan (Phase 3 consideration only)

**How it connects to the desktop:**
1. Desktop app and Android phone must be on the **same WiFi/LAN** (same router)
2. Desktop app shows a QR code in Settings → Mobile App → "Pair Device"
3. Android app scans QR → gets the desktop's LAN IP + a session token
4. Android app sends read-only API requests to a **local REST server** running on the desktop (port 5789, loopback to LAN only — never internet-facing)
5. Desktop Electron app runs a minimal Express server when "Mobile Access" is enabled in settings — user opts in, default off
6. Session token is a 32-byte random hex, 24-hour expiry, stored in electron-store
7. If desktop is off or not on the same network: app shows "Sarang desktop is not reachable on this network"

**Tech stack:**
- Capacitor (not React Native) — reuses existing React components from Sarang desktop UI
- Android 8.0+ (API 26+) — covers 95%+ of current Indian Android devices
- Package size: under 15MB
- No Google Play required — distribute as APK sideload (avoids Play Store review delays and 30% cut)
- Alternative: Progressive Web App (PWA) served by the same local Express server — no install required, works on any device browser on the same network

**Security rules for the local API server:**
- Binds to `0.0.0.0:5789` only when "Mobile Access" is enabled
- All requests require the session token in the `Authorization` header
- Only GET endpoints exposed (no write operations at all)
- If the token is wrong: 401, no error detail
- Disable the server when user is on a public/untrusted network — show a warning if the network changes

**Sarang Pro gating:** Mobile companion is a Sarang Pro feature. Free tier gets the pairing QR but the API returns 402 unless a valid Pro key is active. This is one of the most compelling Pro upgrade reasons for a multi-staff shop.

### 8.8 Auto-Update Mechanism (User-Triggered Only)

"Check for Updates" button in Settings → About. User clicks → checks GitHub Releases API → shows release notes → opens browser to download page. User downloads and runs new installer manually.

**Never:** Background polling on startup. Silent downloads. Forced updates. "You must update to continue" gates.

The GitHub Releases API check is the only network call Sarang ever makes — only when the user explicitly clicks "Check for Updates." This must be disclosed in aszurex.com/sarang-terms.

---

## 9. Competitive Differentiation

| Feature | Tally | Vyapar | Khatabook | OkCredit | ERPNext | **Sarang** |
|---|---|---|---|---|---|---|
| Truly offline | ✅ | ✅ | ❌ cloud | ❌ cloud | ❌ | ✅ |
| Free | ❌ ₹18k | ⚠️ limited | ✅ | ✅ | ✅ self-host | ✅ |
| Free globally | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Hindi UI | ⚠️ partial | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kannada UI | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Tamil UI | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Telugu UI | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Malayalam UI | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Marathi UI | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Gujarati UI | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Modern UI | ❌ | ⚠️ | ✅ mobile | ✅ mobile | ⚠️ | ✅ |
| Zero data collection | ⚠️ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Billing / invoices | ✅ | ✅ | ❌ | ❌ | ✅ complex | ✅ |
| Inventory management | ✅ | ✅ | ❌ | ❌ | ✅ complex | ✅ |
| Credit / ledger tracking | ✅ | ✅ | ✅ core feature | ✅ core feature | ✅ | ✅ |
| 39 industry templates | ❌ | ❌ | ❌ | ❌ | ✅ complex | ✅ |
| Dry Fruit & Spice Store | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Fish/Seafood template | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Paint store template | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Jewellery module | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Restaurant KOT | ❌ | ❌ | ❌ | ❌ | ✅ complex | ✅ |
| Construction BOQ | ❌ | ❌ | ❌ | ❌ | ✅ complex | ✅ |
| RBAC / user roles | ⚠️ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Audit trail | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| E-invoice | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ Phase 2 |
| Multi-branch (LAN) | ✅ paid | ✅ paid | ❌ | ❌ | ✅ | ✅ Phase 3 |

**The Khatabook / OkCredit angle:** 55+ million combined users. They solve one thing: credit tracking. Sarang does credit tracking + billing + inventory + 39 industry templates + 8 languages + full offline privacy. The upgrade path is: Khatabook user who wants to also print invoices and track stock → Sarang. This is a larger addressable pool than Tally's replacement market.

---

## 10. Aszurex.com — Fix This Before Launch

1. **Fix /about and /services pages** — 404 is a credibility killer
2. **Add Vishwas's photo + 3-line bio** — Indian B2B buyers buy from people, not companies
3. **Add Sarang section** — "We built Sarang to demonstrate what we can do for your business"
4. **Add WhatsApp contact** — standard expectation in Indian B2B
5. **Add calendar booking link** (Calendly free tier) — removes friction from "contact us"
6. **Add a blog** — 1 post/month in Kannada + English about MSME tech topics
7. **Add testimonials** — even 2-3 from people you know personally, labelled honestly
8. **Create aszurex.com/sarang-terms** — MUST be live before Sarang ships; must mention the GitHub Releases API check as the only network call

---

## 11. Product Roadmap — Build Phases

Sarang is one product. These are build phases — not separate versions sold to users.

### Phase 1 — Core Build | Platform: Windows 10+ (64-bit)

**10 industry templates:** Retail (2A), Restaurant (2B), Clothing (2C), Electronics (2D), Hardware (2E), Grocery (2F), Plumbing (2G), Electrical (2H), Paint (2I), Construction Materials Distributor (2J)

**Features:**
- Universal billing engine — all 11 document types
- **ALL 8 languages: English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Gujarati**
- Elegant modern UI with Noto Sans fonts bundled for all Indian scripts
- Profit/margin intelligence (Business Summary engine)
- Inventory intelligence (slow/dead stock, reorder alerts)
- Credit tracking (aging, WhatsApp text generator, recovery dashboard)
- About Aszurex + Support page
- First-run legal disclaimer
- 200+ tests, 70%+ coverage, 0 TypeScript errors
- Thermal (80mm/58mm) + A4 + PDF print (`webContents.printToPDF()`)
- NSIS installer, EV code-signed, under 150MB
- Local rotating log file
- SQLite WAL mode + startup integrity check
- "Check for Updates" button (user-triggered)

### Phase 2 — Extended Build | Platform: Windows 10+, macOS 12+

**16 additional templates:** Pharmacy (2K), Auto Workshop (2L), Wholesale (2M), Fish/Seafood (2N), Bakery (2O), Jewellery (2P), Dry Fruit & Spice Retail (2Q), Salon (2R), Hotel (2S), Agricultural Inputs (2T), Real Estate (2U), Tailoring (2V), Printing Press (2W), Gym (2X), Optician (2Y), Timber (2Z)

**Features:**
- Full variant inventory (size × colour matrix)
- Construction contractor lite (BOQ + RA bills + muster roll)
- Attendance module
- Wholesale/distributor features (tiered pricing, van billing, route collection)
- E-invoice via user's own GSP API
- Android companion app (read-only dashboard — owner's mobile view, Phase 2 milestone)
- Punjabi, Bengali languages
- Sarang Pro tier launch (₹2,499/yr or ₹9,999 lifetime)
- Android companion app (Sarang Pro feature — local LAN, read-only reports)

### Phase 3 — Specialist Build | Platform: Windows 10+, macOS 12+, Linux (AppImage)

**13 specialist templates:** Textile Manufacturer (2AA), Construction Contractor (2AB), Petrol Pump (2AC), School/Coaching (2AD), Clinic/Ayurvedic (2AE), Coffee Estate (2AF), Silk Weaving (2AG), Produce/Mandi (2AH), Cold Storage (2AI), Travel Agency (2AJ), Dhaba (2AK), Spice/Dry Fruit Wholesale (2AL), Handicraft Workshop (2AM)

**Features:**
- Full textile manufacturer module (job work challan, cutting plan, export invoice)
- Full construction contractor module (all 5 sub-modules)
- LAN multi-branch sync (LWW + device UUID)
- CA partner dashboard (co-branded export)
- Arabic RTL + Indonesian + Swahili
- Full 12+ language coverage
- Pricing review milestone (assess Pro pricing after 1,000+ active users)

---

## 12. Implementation Phase Map (Development Sprints)

> These are development implementation phases — not product version gates. All build toward the same complete product.

### Implementation Phase 11 — Packaging
**Estimate: 2–3 weeks | Owner: Vishwas + developer | Approval required**

- NSIS installer (Windows 10+, 64-bit)
- Font bundling (all 5 Indian scripts)
- Legal disclaimer first-run screen (mandatory checkbox)
- SQLite WAL mode + startup integrity check
- Local rotating log file
- Auto-update: "Check for Updates" button → GitHub Releases API → opens browser
- **EV Code Signing Certificate (non-negotiable):** Without EV cert, Windows SmartScreen blocks the installer with a warning — kills adoption. DigiCert / Sectigo, ~₹25,000–₹40,000/yr. Apple Developer Program ($99/yr) for macOS in Phase 2.

**Acceptance criteria:**
- [ ] Installer builds on Windows 10 and Windows 11
- [ ] EV code-signed — SmartScreen shows "Published by Aszurex Private Limited"
- [ ] Installs in under 2 minutes on a fresh machine
- [ ] Installer size under 150MB
- [ ] First-run disclaimer blocks proceeding without checkbox
- [ ] All 5 Indian scripts render without system font fallback
- [ ] Uninstaller removes app files; preserves user DB in Documents
- [ ] "Check for Updates" does not auto-run on startup
- [ ] Log file created at correct location; rotates at 5MB

---

### Implementation Phase 12 — Language / i18n
**Estimate: 8–10 weeks | Owner: Vishwas (Kannada + Marathi/Gujarati oversight), freelancers (Tamil/Telugu/Malayalam/Marathi/Gujarati) | Approval required**

- i18next architecture setup (Section 3.3)
- Extract all hardcoded English strings into locale JSON
- 8 language translations with native speaker review (see Section 3.2 ownership table)
- Language switcher in settings
- Test every screen at 1366×768 in each language
- Gujarati script (Gujarati Unicode block U+0A80–U+0AFF) — bundle NotoSansGujarati font
- Marathi uses Devanagari script — same font as Hindi (NotoSansDevanagari already bundled)

**Acceptance criteria:**
- [ ] All 8 languages switch without restart
- [ ] Zero hardcoded English strings in any non-English mode
- [ ] All Indian scripts render without system font fallback (Kannada/Tamil/Telugu/Malayalam/Gujarati/Devanagari)
- [ ] Hindi numerals toggle works; Gujarati numerals toggle works for Gujarati locale
- [ ] Every language reviewed by native speaker (signed off by Vishwas)
- [ ] Billing invoice renders correctly in all 8 languages
- [ ] No text overflow at 1366×768 in any language
- [ ] Gujarati font added to Phase 11 installer bundle (add NotoSansGujarati to assets/fonts/)

---

### Implementation Phase 13 — Billing Polish
**Estimate: 3–4 weeks | Approval required**

- All 11 document types
- Thermal 80mm + 58mm print testing on physical printers
- PDF via `webContents.printToPDF()`
- WhatsApp text generator for payment reminders
- IGST logic (inter-state billing)
- Invoice watermarks (ORIGINAL / DUPLICATE / CANCELLED / PROFORMA)
- UPI QR on invoice (local generation)

**Acceptance criteria:**
- [ ] All 11 document types generate with correct GST treatment
- [ ] Thermal print works on 80mm and 58mm
- [ ] PDF export produces properly formatted A4 invoice with logo
- [ ] IGST correctly applied when buyer state ≠ seller state
- [ ] Invoice PDF generation in under 2 seconds

---

### Implementation Phase 14 — Inventory Intelligence
**Estimate: 2–3 weeks | Approval required**

- Slow/dead stock engine with configurable thresholds
- Reorder alerts
- Near-expiry alerts (Grocery + Pharmacy templates)
- Product margin calculation with RED warning

**Acceptance criteria:**
- [ ] Dashboard shows correct slow/dead/reorder counts
- [ ] Expiry alerts appear within configured window
- [ ] Product margin calculation correct; updates on price change
- [ ] All thresholds configurable per business
- [ ] No degradation with 10,000+ products

---

### Implementation Phase 15 — Credit Module
**Estimate: 2–3 weeks | Approval required**

- Aging report (4 buckets)
- Credit limit enforcement at billing
- Supplier credit tracking UI
- Recovery dashboard
- WhatsApp reminder text generator

**Acceptance criteria:**
- [ ] Aging bucket totals match ledger entries
- [ ] Billing blocks with clear message when over credit limit
- [ ] WhatsApp text generates with correct invoice references
- [ ] Recovery dashboard total matches sum of customer outstanding

---

### Implementation Phase 16 — Industry Templates Phase 1 Polish
**Estimate: 4–6 weeks | Approval required**

- Restaurant: dietary tags, KDS mode, advance booking, combo pricing
- Clothing: size × colour matrix UI, tag scanner, exchange management
- Hardware: project tagging, credit limit enforcement, price revision log
- Grocery: expiry tracking, loyalty points, batch numbers
- Electronics: IMEI tracking, warranty expiry alerts
- Paint: shade catalogue, tinting reference, project tracking
- Plumbing/Electrical: project tagging, bulk pricing

**Acceptance criteria:**
- [ ] Restaurant dietary tags appear on menu and KOT
- [ ] Clothing size × colour grid live stock; zero-stock cells blocked
- [ ] Hardware project tagging works; credit limit blocks correctly
- [ ] Grocery items expiring in 30 days appear in alert dashboard
- [ ] Paint shade catalogue searchable and linked to billing

---

### Implementation Phase 17 — About + Legal
**Estimate: 1–2 weeks | Approval required**

- About Aszurex / Support page (Feature 11)
- First-run disclaimer screen (Section 2.2 exact text)
- Legal language audit across ALL UI screens (Feature 15 table)
- aszurex.com/sarang-terms must be live before this phase ships

**Acceptance criteria:**
- [ ] First-run disclaimer appears once; blocked without checkbox
- [ ] aszurex.com/sarang-terms is live and not a 404
- [ ] Zero instances of prohibited language in entire UI
- [ ] About page renders in all 6 languages
- [ ] UPI QR on About page generates locally without network call
- [ ] Founder note personalised and signed by Vishwas

---

### Implementation Phase 18 — Test Coverage
**Estimate: 3–4 weeks | Approval required**

- billing.service (all 11 document types, 15+ test cases)
- payment.service (recordPayment, split payments, ledger updates)
- Tax calculation math (CGST/SGST split, IGST inter-state)
- Export service, settings service
- Backup/restore cycle
- IPC handler integration tests (all 20 handler files)

**Acceptance criteria:**
- [ ] 200+ tests passing
- [ ] 0 TypeScript errors across both tsconfig files
- [ ] Coverage ≥ 70% on all service files
- [ ] IGST vs CGST/SGST tested for both interstate and intrastate
- [ ] Backup/restore end-to-end test passes

---

### Implementation Phase 19 — Launch
**Estimate: 2–3 weeks | Owner: Vishwas | Approval required**

**Pre-launch checklist:**
- [ ] aszurex.com/sarang-terms live (includes GitHub API check disclosure)
- [ ] aszurex.com/about live
- [ ] Vishwas's photo and bio on aszurex.com
- [ ] WhatsApp contact on aszurex.com
- [ ] EV code signing certificate obtained; installer signed
- [ ] Installer tested on fresh Windows 10 and Windows 11
- [ ] All 8 languages reviewed by native speakers (Marathi + Gujarati added to Phase 1)
- [ ] All 10 Phase 1 templates tested end-to-end
- [ ] 200+ tests passing
- [ ] Trademark filed for "Sarang"
- [ ] GitHub repo public with Sarang Community License
- [ ] First Kannada YouTube tutorial recorded and uploaded
- [ ] 10 MSME owner interviews completed
- [ ] 3+ beta testers used for real billing for 2+ weeks

**Launch success metrics (30 / 90 days):**

| Metric | 30-day | 90-day |
|---|---|---|
| Total installs | 100 | 500 |
| Active installs (last 7 days) | 40 | 200 |
| Aszurex enquiries from Sarang | 2 | 10 |
| Kannada YouTube views | 500 | 5,000 |
| GitHub stars | 20 | 100 |
| All 10 Phase 1 templates in use | — | ✅ |

---

### Phase 1 Budget Estimate

A realistic cost estimate for Vishwas to plan resources before committing to the build.

| Item | Cost (₹) | Notes |
|---|---|---|
| EV Code Signing Certificate (Windows) | 25,000–40,000/yr | DigiCert / Sectigo — non-negotiable for SmartScreen |
| Apple Developer Program (macOS — Phase 2) | ~8,250/yr | $99 USD at current rate — defer to Phase 2 |
| Freelance translations (7 languages) | 56,000–1,05,000 | Tamil, Telugu, Malayalam, Marathi, Gujarati, Hindi spot-check, Kannada community |
| Noto Sans font licensing | 0 | Open Font License — free to bundle |
| Physical printer testing (thermal 80mm + 58mm) | 3,000–8,000 | Purchase or borrow printers for QA testing |
| Beta tester bounties (10 people, 2-week usage) | 5,000–15,000 | Small payment or free Pro key as compensation |
| Domain / hosting for aszurex.com/sarang-terms | 1,500–3,000/yr | Minimal static page hosting |
| Trademark filing India (Class 42) | 4,500–9,000 | Government fee + agent fee |
| Miscellaneous (tools, accounts, CI) | 5,000–10,000 | GitHub Actions, misc SaaS |
| **Phase 1 total estimate** | **₹1,00,000–₹1,90,000** | **Primarily the EV cert + translations** |

**Cash flow note:** EV certificate is the largest single-year cost. Translations are a one-time upfront expense; they don't recur unless the UI strings change significantly. The biggest variable is how much beta tester compensation is needed. A minimum viable Phase 1 launch can happen for under ₹1,25,000 if Vishwas writes the Marathi + Gujarati translations personally or through community contributions.

---

## 13. Launch Criteria — Non-Negotiable Gate

Sarang does not ship Phase 1 until every item is checked.

**Product:**
- [ ] All 11 billing document types generate, print (thermal + A4), export to PDF
- [ ] 10 Phase 1 industry templates complete and tested end-to-end
- [ ] All 8 languages working; all Indian scripts render without fallback (including Gujarati)
- [ ] First-run disclaimer shown and acknowledged before any feature is accessible
- [ ] Legal language audit passed — zero prohibited terms in UI

**Quality:**
- [ ] 200+ tests passing
- [ ] 0 TypeScript errors
- [ ] Billing screen loads under 1 second (cold, with 1,000 products in DB)
- [ ] Invoice PDF generation under 2 seconds
- [ ] App starts under 5 seconds on mid-range laptop (i5, 8GB RAM, SSD)
- [ ] No unhandled exceptions visible to users

**Infrastructure:**
- [ ] NSIS installer built, EV code-signed, under 150MB
- [ ] aszurex.com/sarang-terms live
- [ ] aszurex.com/about live
- [ ] "Check for Updates" user-triggered only
- [ ] Local log file in place; crash screen shows "Copy Error Details"

**Pre-launch research:**
- [ ] 10 structured MSME owner interviews completed
- [ ] 3+ beta testers used for real billing for 2+ weeks

---

## 14. Distribution Strategy

### Phase 1 — Organic (Launch to 6 months)
1. GitHub release (installer + source code under Sarang Community License)
2. Invoice footer — "Powered by Sarang Business OS — free at aszurex.com"
3. YouTube Kannada — Kirana store, Restaurant, Hardware store tutorials
4. WhatsApp forwarding — "I use Sarang for billing — free, offline, your data stays with you. aszurex.com/sarang"

### Phase 2 — CA Network (3–6 months after launch)
1. CA partner outreach — 5 CA firms in Bangalore
2. Computer shop resellers — 3–5 shops in Hubli/Mysuru pre-install Sarang on customer laptops

### Phase 3 — Community (6–12 months)
1. GitHub community — translations, bug reports in Kannada/Hindi
2. MSME events — Karnataka MSME Dept, KIADB exhibitions, trade fairs
3. Android companion app (Phase 2 milestone)

### What Not to Do Before 1,000 Active Users
No paid advertising. No Product Hunt. No VC pitches on user numbers. No partnerships requiring data sharing.

---

## 15. Open Source and Licensing

**Decision: Source-Available (Sarang Community License v1.0)**

| License | Why Rejected |
|---|---|
| MIT | Allows fork + cloud sync + commercial redistribution — creates "Sarang Cloud Edition" by competitors |
| GPL | Scares Indian businesses; "must open-source your customisations" perception kills Pro revenue |
| AGPL | Same as GPL, more confusing |

**Sarang Community License v1.0 — Key Clauses:**
```
PERMITTED:   Read, audit, install, run for own business, modify for own business
             Contribute back via pull request (contribution licensed to Aszurex)

NOT PERMITTED: Redistribute commercially or bundle in a commercial product
               Offer as a hosted or SaaS service under any name
               Remove or modify "Powered by Sarang" attribution
               Use "Sarang" brand name for any derivative product

COMMERCIAL:  Contact Aszurex Private Limited for a commercial licence
             (white-label, reseller, SaaS, OEM)
```

---

## 16. Performance and Quality Standards

All targets below are Phase 1 launch blockers — not aspirational.

### Response Time Targets

| Operation | Target |
|---|---|
| App startup (cold) | < 5 seconds |
| Login | < 1 second |
| Billing screen open | < 1 second |
| Product search (10,000 products) | < 300ms |
| Invoice save | < 500ms |
| Invoice PDF generation | < 2 seconds |
| Thermal print | < 3 seconds |
| Dashboard KPI load | < 2 seconds |
| Any DB operation | < 500ms (99th percentile) |

### Data Volume Targets (must not degrade performance)

| Dataset | Target |
|---|---|
| Products | 10,000 |
| Customers | 5,000 |
| Invoices | 50,000 |
| Ledger entries | 500,000 |

### Code Quality Standards

- TypeScript: 0 errors at all times (both tsconfig files)
- Tests: all pass before any commit to main
- ESLint: 0 errors in production build
- Renderer bundle: < 5MB (excluding fonts/assets)
- Memory: < 300MB RAM during normal billing
- No unhandled exceptions reaching users

---

## 17. Quarterly Review Process

**Owner: Vishwas** — runs this personally every quarter before any new feature work begins.

### GST Rate Audit (every 3 months)
- Review all HSN presets in every template against current GST notification
- Update changed rates in template configuration
- Communicate rate changes via in-app notification (local, no server)
- **Next scheduled review: September 2026**

### Competitive Landscape Check (every 3 months)
- Check if Vyapar/Tally has added Kannada/Tamil/Telugu/Malayalam — if yes, launch urgency increases
- Check for new offline business software
- Check Google Pay / PhonePe for business management features
- Update Section 9 competitive table accordingly

### MSME Owner Interviews — Before Phase 1 Ships

**10 structured interviews minimum. Owner: Vishwas.**

**Targets:**
- 2 × Kirana/retail (one Bangalore, one Hubli/Mysuru)
- 2 × Restaurant owners
- 1 × Garment shop owner (Bangalore or Tirupur)
- 1 × Hardware store owner
- 1 × Fish/seafood shop (Kochi or Mangaluru)
- 1 × Dry fruit / spice store owner (Delhi Khari Baoli or local)
- 1 × CA who advises MSMEs
- 1 × Tamil Nadu or Kerala MSME

**Questions:** What software today? Most annoying thing about it? Last time you lost data? Language preference? Device used? What would make you recommend to another owner?

### Post-Launch Feedback (no telemetry)
- In-app: user types → copies to clipboard with pre-filled email subject
- GitHub Issues: primary bug tracker
- WhatsApp: for users who won't file issues

---

## 18. Technical Decisions Log

Decisions recorded here are closed. Will not be relitigated without written reason from Vishwas.

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| PDF generation | `webContents.printToPDF()` | html-pdf-node, puppeteer | Zero extra dependencies; uses bundled Chromium |
| LAN sync algorithm | Last-Write-Wins + device UUID + millisecond timestamp | Vector clocks, CRDTs | Sufficient for 2-3 branch retail; dramatically simpler |
| License model | Source-Available (Sarang Community License v1.0) | MIT, GPL, AGPL | MIT allows commercial redistribution; GPL scares businesses |
| Font delivery | Bundled Noto Sans TTF (~12MB) | System fonts, Google Fonts CDN | System fonts unreliable on Windows 10; CDN violates offline-first |
| E-invoice routing | User's own GSP credentials, direct API call | Aszurex as intermediary | Aszurex must never be in the data path |
| Multi-branch sync | Phase 3, LAN-only | Phase 1, cloud sync | Cloud violates core philosophy; build after 1,000+ users |
| Thermal printing | electron-pos-printer npm | Custom ESC/POS | Maintained library, well-tested |
| State management | Zustand | Redux, Context API | Lightweight, TypeScript-native |
| IPC structure | 20 domain handler files in `src/main/ipc/handlers/` | Single monolithic index.ts | Monolithic was 800+ lines; domain split enables parallel development |
| DB migration tool | `prisma migrate deploy` | `prisma db push` | Migration history files for safe production upgrades |
| Auto-update | User-triggered "Check for Updates" → GitHub API → opens browser | Silent background check, forced update | Silent calls violate offline-first; forced updates violate user trust |
| Crash reporting | Local rotating log + "Copy Error Details" button | Sentry, Bugsnag, any cloud telemetry | Zero telemetry rule is absolute |
| International pricing | **Free globally** | Geographic pricing tiers, premium for non-India | Goal is adoption everywhere; Aszurex service engagements are the revenue model in every market. Pricing review deferred to Phase 3 milestone after 1,000+ active users globally. |
| Product versioning | **One product, three build phases** | V1/V2/V3 as separate releases | Sarang is one complete product; phases are build sequence, not version gates sold to users |
| Dry fruit store | **Dedicated retail template (2Q) + separate wholesale (2AL)** | Single combined template | Retail (walk-in, 100g-1kg, festive packs) ≠ Wholesale (bulk, 30-60 day credit, lot-based) — different workflows, different screens |
| Sarang Pro key validation | **Offline HMAC-SHA256 signature: sign(machineId \|\| edition \|\| expiryDate) with Aszurex private key; verify with bundled public key** | Cloud validation call to Aszurex API | Cloud validation violates offline-first and zero-data rules. Key is generated at purchase time by a script on Aszurex's side, never verified at runtime via network. Machine binding prevents key sharing. The bundled public key verifies authenticity. Key format: `SRNG-[base32(signature truncated to 24 chars)]-[expiryYYMM]`. If machine UUID changes (hardware swap): user contacts Aszurex for a re-issue — one re-issue per year included. |
| Android companion app | **Capacitor PWA served by local Express server on desktop; APK sideload** | React Native, Google Play Store distribution | Capacitor reuses existing React components. Local Express server means zero cloud, zero Play Store dependency. APK sideload avoids 30% Google cut and review delays. PWA fallback works on any browser on the same LAN. |
| Phase 1 language count | **8 languages (add Marathi + Gujarati to Phase 1)** | Marathi/Gujarati as Phase 2 | Maharashtra is India's 2nd largest economy; Gujarat has highest MSME density. Both markets need Sarang from day 1. Budget impact: +₹16,000–₹30,000 for two additional translation contracts — acceptable. |

---

## 19. Phase Completion Report

See **`docs/PHASE_COMPLETION_REPORT.md`** for the full build session log, per-phase completion status, codebase metrics, and what remains to be built.

**Current status (June 2026):** Phase 0 ✅ · Phase 1 ✅ · Phase 1.1 (UX) ✅ · TypeScript: 0 errors · EV certificate: pending external purchase.

---

*This document is the canonical reference for all Sarang product decisions.*

*Every feature request must clear Section 0 (Core Philosophy) before acceptance.*

*Every implementation phase requires Vishwas's explicit approval before execution.*

*GST rates in this document are as of June 2026 — verify against current notifications before Phase 1 ships.*

*Offline First. No Cloud. No Data. Not Accounting Software. Free for Everyone, Everywhere. Legally Clean. Sarang.*

*Aszurex Internal — Not for public distribution*
