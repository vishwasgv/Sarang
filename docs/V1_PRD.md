# V1_PRD.md

### Sarang Business OS Lite

### Powered by Aszurex

Version: 1.0

Document Type: Product Requirements Document (PRD)

## PURPOSE OF THIS DOCUMENT

This document defines the exact scope of Version 1.

Its primary purpose is to prevent:

- Scope creep
- Unnecessary complexity
- Over-engineering
- Feature bloat
- Long development cycles

If a feature is not listed in the MUST HAVE section, it should not be considered mandatory for Version 1.

## V1 PRODUCT GOAL

Build a professional-grade offline-first Business Operating System that:

- Demonstrates engineering excellence
- Demonstrates design excellence
- Generates trust in Aszurex
- Generates leads for Aszurex
- Requires minimal support
- Requires no cloud infrastructure
- Requires no recurring costs

The software should feel polished enough that users immediately trust the capabilities of Aszurex.

## TARGET USERS

Version 1 will focus on:

### Restaurant

### Retail Store

### Hardware / Glass / Plywood Store

### Distributor / Wholesaler

These industries share a common business engine.

## V1 MUST HAVE FEATURES

### 1. BUSINESS SETUP WIZARD

First-run experience:

Business Name

Business Type

Country

Currency

Tax Model

Business Address

Phone Number

Email (Optional)

Tax Number (Optional)

UPI ID (Optional)

Logo Upload

Admin User Creation

Launch Dashboard

### 2. GLOBAL CONFIGURATION

Support:

Any Country

Any Currency

Any Tax Model

Examples:

GST

VAT

Sales Tax

No Tax

Currency format must be configurable.

Examples:

USD

EUR

GBP

AUD

CAD

NZD

SGD

INR

AED

SAR

ZAR

All ISO-4217 currencies.

### 3. AUTHENTICATION

Roles:

Admin

Manager

Cashier

Staff

Kitchen Staff

Requirements:

Password Hashing

Role Permissions

Session Management

Local Authentication

No cloud login.

No Aszurex accounts.

### 4. DASHBOARD

Dashboard must provide:

Today's Sales

Weekly Sales

Monthly Sales

Revenue

Expenses

Profit Estimate

Outstanding Amounts

Low Stock Alerts

Recent Activity

Quick Actions

Business Health Overview

### 5. PRODUCT MANAGEMENT

Create Product

Edit Product

Delete Product

Product Categories

SKU

Barcode

Product Image

Cost Price

Selling Price

Tax Configuration

Active/Inactive Status

### 6. INVENTORY MANAGEMENT

Stock Tracking

Stock Adjustment

Stock Movement History

Low Stock Alerts

Supplier Tracking

Inventory Valuation

Purchase History

Stock Reports

### 7. CUSTOMER MANAGEMENT

Customer Records

Phone Number

Email

Address

Notes

Purchase History

Outstanding Balances

Credit Tracking

Customer Reports

### 8. SUPPLIER MANAGEMENT

Supplier Records

Contact Details

Purchase History

Outstanding Payments

Supplier Reports

Purchase Orders

### 9. BILLING ENGINE

Fast Workflow:

Search Product

Add Product

Quantity Update

Discount

Tax Calculation

Generate Bill

Print

Done

Keyboard Friendly

Touch Friendly

Minimal Clicks

### 10. PAYMENT RECORDING

Cash

UPI

Card

Wallet

Credit

Split Payments

Outstanding Tracking

IMPORTANT:

Only record payments.

Do NOT process payments.

Do NOT verify payments.

### 11. UPI QR GENERATION

Business enters:

UPI ID

Example:

business@upi

Application generates dynamic UPI QR.

Customer scans.

Customer pays.

No payment gateway.

No transaction verification.

No payment settlement.

### 12. TAX ENGINE

Support:

GST

VAT

Sales Tax

No Tax

Tax rates configurable.

Tax reports available.

### 13. PRINTING

80mm Thermal Receipt

A4 Invoice

Print Preview

PDF Export

KOT Printing (Restaurant Template)

### 14. REPORTS

Daily Sales Report

Weekly Report

Monthly Report

Yearly Report

Inventory Report

Customer Report

Supplier Report

Tax Report

Outstanding Report

Expense Report

Custom Date Range Reports

### 15. ANALYTICS

Revenue Trends

Top Products

Top Categories

Low Stock Products

Customer Insights

Outstanding Amounts

Sales Overview

Inventory Overview

### 16. EXPENSE MANAGEMENT

Rent

Salary

Utilities

Supplies

Custom Expenses

Expense Reports

Profit Estimation

### 17. BACKUP SYSTEM

One Click Backup

One Click Restore

Database Export

Database Import

Backup Reminder

Backup Validation

### 18. AUDIT LOGS

Login Activity

Product Changes

Inventory Changes

Price Changes

User Changes

Settings Changes

Timestamp Tracking

## INDUSTRY TEMPLATES

## RESTAURANT TEMPLATE

Menu Categories

KOT

Table Numbers

Recipe Mapping

Ingredient Tracking

Takeaway Orders

Daily Closing

## RETAIL TEMPLATE

Barcode Billing

Returns

Exchanges

Customer Credits

## HARDWARE / GLASS / PLYWOOD TEMPLATE

Area-Based Pricing

Credit Sales

Supplier Orders

Customer Ledger

## DISTRIBUTOR TEMPLATE

Bulk Orders

Customer Ledger

Outstanding Tracking

Purchase Orders

## SHOULD HAVE (IF TIME PERMITS)

Dark Mode

Advanced Charts

Import From CSV

Export Templates

Advanced Filtering

Multi-Language Support

Keyboard Shortcuts

Advanced Dashboard Widgets

## EXCLUDED FROM V1

Explicitly DO NOT build:

Android Application

CRM

Helpdesk

WhatsApp Integration

SMS Integration

Email Marketing

Loyalty Programs

Cloud Sync

Online Ordering

Payment Gateway Integration

AI Features

Vendor Portal

Customer Portal

Manufacturing ERP

Document Management

Multi-Branch Synchronization

Remote Databases

Any SaaS Infrastructure

## PERFORMANCE REQUIREMENTS

Installer Size:

Less than 150 MB

Startup Time:

Less than 3 Seconds

Memory Usage:

Optimized

Database:

SQLite

Offline First

## SUCCESS CRITERIA

The product should feel:

Professional

Reliable

Modern

Fast

Simple

Trustworthy

A user should be able to:

Install

Configure

Use

Without contacting Aszurex.

## FINAL V1 OBJECTIVE

Version 1 should prove:

Aszurex can build:

- Business Systems
- Inventory Systems
- Reporting Systems
- Analytics Systems
- Workflow Systems
- Desktop Applications

The goal is not feature quantity.

The goal is trust, credibility, usability, and demonstrating engineering excellence.

## V1 ACCEPTANCE CRITERIA

### Authentication Module
- [ ] Admin can create user accounts with specified roles
- [ ] Login enforces password before granting access
- [ ] Cashier role cannot access admin-only screens
- [ ] Failed login attempts are logged in audit log
- [ ] Session persists across app restart (configurable)

### Billing Module
- [ ] Invoice created with at least one line item, with correct tax per item
- [ ] Subtotal, tax total, and grand total match manual calculation exactly
- [ ] Invoice number auto-increments sequentially, no duplicates
- [ ] Invoice PDF exports with business logo and "Powered by Aszurex" footer
- [ ] 80mm thermal receipt prints correctly with QR code (if UPI configured)
- [ ] Payment recording does NOT confirm or verify payment (PM005)
- [ ] Invoice cannot record payment greater than outstanding balance

### Inventory Module
- [ ] Product quantity decreases when an invoice is finalized
- [ ] Product quantity increases when stock is added manually
- [ ] Low stock alert appears when quantity is at or below reorder level
- [ ] All stock movements visible in movement history with timestamps

### Customer Module
- [ ] Customer created with name (minimum) and optional contact details
- [ ] Customer's full invoice and payment history is viewable
- [ ] Customer outstanding balance is calculated correctly
- [ ] Customer searchable by name or phone number

### Reports Module
- [ ] Sales report shows correct revenue for any selected date range
- [ ] Tax report shows total tax collected correctly
- [ ] All reports export to PDF and CSV successfully
- [ ] Reports respect configured currency format and date format

### Backup Module
- [ ] Backup creates a `.sarang-backup` file (ZIP with manifest.json + sarang.db)
- [ ] SHA-256 checksum written to manifest.json
- [ ] Restore validates checksum before proceeding — aborts if mismatch
- [ ] Pre-restore safety backup created automatically before any restore operation

### Onboarding / Setup
- [ ] Business name, currency, tax model, industry template configurable during setup
- [ ] Setup completes without internet access
- [ ] Setup completes without creating any online account

### Security
- [ ] All BrowserWindows: contextIsolation:true, sandbox:true, nodeIntegration:false
- [ ] No renderer code imports Prisma directly
- [ ] All IPC handlers call requirePermission() before any logic
- [ ] No network requests made during any standard workflow
- [ ] electron-builder publish config is null

Powered by Aszurex.

Trust Beyond Limits.
