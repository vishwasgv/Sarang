# LOCALIZATION_AND_GLOBALIZATION.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Localization & Globalization Specification

## PURPOSE

This document defines:

- Globalization Strategy
- Localization Standards
- Currency Support
- Date Formats
- Time Formats
- Tax Models
- Language Support
- Regional Formatting
- International Business Rules

The objective is to ensure Sarang can be used globally without major architectural changes.

## CORE PHILOSOPHY

Sarang should be:

Built Once.

Usable Everywhere.

The software should never assume:

Country

Currency

Language

Tax System

Date Format

Measurement System

Business Type

## DEFINITIONS

### GLOBALIZATION (i18n)

Designing Sarang to work globally.

### LOCALIZATION (l10n)

Adapting Sarang to a specific region.

## VERSION 1 STRATEGY

Primary Language:

English

Primary Regions:

India

United States

United Kingdom

Canada

Australia

New Zealand

Singapore

UAE

South Africa

Architecture must support future expansion.

## COUNTRY CONFIGURATION

During Setup Wizard:

User selects:

Country

Currency

Tax Model

Timezone

Date Format

Number Format

These become business settings.

## LANGUAGE SUPPORT

Version 1:

English Only

Architecture must support:

Multiple Languages

Without code changes.

## LANGUAGE STORAGE RULE

Never hardcode UI text.

Use:

Translation Keys

Example:

dashboard.sales.today

instead of:

Today's Sales

## FUTURE LANGUAGES

Reserved:

Hindi

Kannada

Tamil

Telugu

Malayalam

Marathi

Gujarati

Punjabi

Spanish

French

German

Portuguese

Arabic

Chinese

Japanese

## CURRENCY SUPPORT

Mandatory:

ISO-4217 compliant currencies.

Examples:

USD

EUR

GBP

INR

CAD

AUD

NZD

SGD

AED

SAR

ZAR

JPY

CNY

CHF

## CURRENCY CONFIGURATION

Store:

Currency Code

Currency Symbol

Currency Position

Decimal Precision

Example:

USD

$

Prefix

2 Decimals

## CURRENCY DISPLAY EXAMPLES

United States

$1,250.50

United Kingdom

£1,250.50

Europe

1.250,50 €

India

₹1,250.50

## DECIMAL HANDLING

Default:

2 Decimal Places

Configurable:

0

2

3

4

Decimals

## NUMBER FORMATS

Support:

US Style

European Style

Indian Style

Examples:

US

1,234,567.89

European

1.234.567,89

Indian

12,34,567.89

## DATE FORMATS

Supported:

DD/MM/YYYY

MM/DD/YYYY

YYYY-MM-DD

DD-MM-YYYY

Examples:

India

31/12/2026

USA

12/31/2026

ISO

2026-12-31

## TIME FORMATS

Support:

12 Hour

24 Hour

Examples:

08:30 PM

20:30

## TIMEZONE SUPPORT

Store:

Timezone Per Business

Examples:

Asia/Kolkata

America/New\_York

Europe/London

Australia/Sydney

## TAX FRAMEWORK SUPPORT

Sarang must never assume GST.

Support:

GST

VAT

Sales Tax

Custom Tax

No Tax

## TAX TERMINOLOGY

Display based on configuration.

Examples:

GST

VAT

Sales Tax

Tax

## ADDRESS FORMATS

Must support:

Different country structures.

Example:

India

City

State

PIN Code

USA

City

State

ZIP Code

UK

Town

County

Postcode

## PHONE NUMBER SUPPORT

Store:

Country Code

Phone Number

Examples:

\+91

\+1

\+44

\+61

## MEASUREMENT SYSTEMS

Support:

Metric

Imperial

Custom

Metric:

Kg

Gram

Meter

Liter

Imperial:

Pound

Foot

Gallon

Ounce

## PRODUCT UNITS

Configurable.

Examples:

Piece

Kg

Meter

Square Foot

Square Meter

Liter

Box

Pack

Carton

## PAPER SIZES

Support:

A4

Letter

Legal

Thermal 58mm

Thermal 80mm

## INVOICE FORMATS

Adapt to:

Country

Currency

Tax Model

Paper Size

## REPORT FORMATS

Reports should automatically respect:

Date Format

Currency Format

Number Format

Language

Timezone

## SEARCH & SORTING

Future-ready for:

Unicode

Multi-language Content

International Characters

Examples:

José

François

Müller

Vishwas

محمد

## DATABASE REQUIREMENTS

All text fields:

UTF-8

Unicode Safe

Future Language Compatible

## UI DESIGN REQUIREMENTS

Avoid:

Country Flags

Country Assumptions

Currency Assumptions

Tax Assumptions

Use:

Configuration Driven Design

## EXPORT REQUIREMENTS

PDF

CSV

Excel

must preserve:

Unicode

Currency Formatting

Date Formatting

Localization Settings

## IMPORT REQUIREMENTS

Accept:

Localized Formats

Multiple Date Formats

Multiple Number Formats

Multiple Currency Formats

## INDUSTRY TEMPLATE LOCALIZATION

Industry templates must remain:

Country Agnostic

Currency Agnostic

Tax Agnostic

## PRIVACY & GLOBALIZATION

Localization must not require:

Cloud Services

Remote Translation APIs

External Data Collection

All localization data stored locally.

## ACCESSIBILITY REQUIREMENTS

Support:

Readable Fonts

High Contrast

Scalable Text

Keyboard Navigation

Future RTL Support

## FUTURE RTL SUPPORT

Reserved:

Arabic

Hebrew

Persian

Architecture should support:

Right-to-Left Layouts

without redesigning the application.

## GLOBAL DEPLOYMENT OBJECTIVE

A business owner in:

India

United States

United Kingdom

Canada

Australia

Singapore

UAE

South Africa

should all be able to install Sarang and use it naturally.

## TRUST & TRANSPARENCY STATEMENT

By default, Sarang does not collect, transmit, or store your business data on Aszurex systems.

Your business data remains on your device.

Localization settings are stored locally and controlled entirely by the business owner.

## SUCCESS CRITERIA

Changing:

Country

Currency

Date Format

Tax Model

Timezone

should require configuration changes only.

No code changes.

## FINAL PRINCIPLE

Sarang should never feel like:

"Software made for one country."

It should feel like:

"Software made for businesses everywhere."

Global By Design.

Local By Configuration.

## LOCALE CONFIGURATION EXAMPLES

### Date Format Examples by Country

| Country | Locale Code | Date Format | Example |
|---------|------------|-------------|---------|
| India | en-IN | DD/MM/YYYY | 18/06/2026 |
| United States | en-US | MM/DD/YYYY | 06/18/2026 |
| United Kingdom | en-GB | DD/MM/YYYY | 18/06/2026 |
| Australia | en-AU | DD/MM/YYYY | 18/06/2026 |
| Canada | en-CA | YYYY-MM-DD | 2026-06-18 |
| Germany | de-DE | DD.MM.YYYY | 18.06.2026 |
| UAE | en-AE | DD/MM/YYYY | 18/06/2026 |
| Singapore | en-SG | DD/MM/YYYY | 18/06/2026 |

### Number Format Examples by Country

| Country | Locale Code | 1 Million | 1.5 | Decimal Sep | Group Sep |
|---------|------------|-----------|-----|------------|-----------|
| India | en-IN | 10,00,000 | 1.5 | . | , |
| US / EU | en-US | 1,000,000 | 1.5 | . | , |
| Germany | de-DE | 1.000.000 | 1,5 | , | . |
| France | fr-FR | 1 000 000 | 1,5 | , | space |

### Currency Format Examples

| Country | Currency | Symbol | Code | Example (1500) |
|---------|----------|--------|------|----------------|
| India | Indian Rupee | ₹ | INR | ₹1,500.00 |
| United States | US Dollar | $ | USD | $1,500.00 |
| United Kingdom | British Pound | £ | GBP | £1,500.00 |
| European Union | Euro | € | EUR | €1,500.00 |
| Australia | Australian Dollar | A$ | AUD | A$1,500.00 |
| UAE | UAE Dirham | AED | AED | AED 1,500.00 |
| Singapore | Singapore Dollar | S$ | SGD | S$1,500.00 |
| South Africa | South African Rand | R | ZAR | R1,500.00 |
| Saudi Arabia | Saudi Riyal | SAR | SAR | SAR 1,500.00 |
| Canada | Canadian Dollar | CA$ | CAD | CA$1,500.00 |

### JavaScript Formatting with Intl API

```typescript
// Use Intl.NumberFormat for locale-aware currency display
function formatCurrency(amount: number, currencyCode: string, localeCode: string): string {
  return new Intl.NumberFormat(localeCode, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Usage examples:
formatCurrency(1500, 'INR', 'en-IN')  // → "₹1,500.00"
formatCurrency(1500, 'USD', 'en-US')  // → "$1,500.00"
formatCurrency(1500, 'EUR', 'de-DE')  // → "1.500,00 €"
```

### Tax Model Defaults by Country

| Country | Default Tax Model | Rate Example | Note |
|---------|-----------------|--------------|------|
| India | GST | 18% | CGST 9% + SGST 9% |
| UK | VAT | 20% | Standard rate |
| Germany | VAT | 19% | Mehrwertsteuer |
| Australia | GST | 10% | Goods and Services Tax |
| USA | Sales Tax | Varies by state | No default — user configures |
| UAE | VAT | 5% | Standard rate since 2018 |
| Singapore | GST | 9% | Since 2024 |
| South Africa | VAT | 15% | Standard rate |
| Canada | GST/HST | 5–15% | Varies by province |
| Saudi Arabia | VAT | 15% | Since 2020 |

Sarang stores the tax model and rate as configured by the user. Rates shown above are reference only — users must configure correct current rates.

Powered by Aszurex.

Trust Beyond Limits.
