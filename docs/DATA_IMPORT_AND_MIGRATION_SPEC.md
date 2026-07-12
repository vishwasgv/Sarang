# DATA_IMPORT_AND_MIGRATION_SPEC.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Data Import & Migration Specification

## PURPOSE

This document defines:

- Import Strategy
- Migration Strategy
- Supported Data Sources
- Validation Rules
- Data Mapping Rules
- Error Handling
- Rollback Rules
- Import User Experience

The objective is:

Reduce Switching Friction

Increase Adoption

Preserve Data Integrity

Minimize Support Requests

## CORE PHILOSOPHY

Businesses should be able to move into Sarang without manually re-entering data.

Migration should feel:

Safe

Fast

Simple

Predictable

## IMPORT OBJECTIVES

A business should be able to import:

Products

Customers

Suppliers

Inventory

Opening Balances

Price Lists

Categories

within minutes.

## SUPPORTED IMPORT SOURCES

Version 1

CSV

Excel (.xlsx)

Future

Tally Exports

Busy Exports

Vyapar Exports

Zoho Exports

QuickBooks Exports

Custom Imports

## SUPPORTED IMPORT MODULES

Products

Customers

Suppliers

Inventory

Opening Stock

Opening Customer Balances

Opening Supplier Balances

Expense Categories

Product Categories

Business Configuration

## IMPORT WIZARD

Mandatory Feature.

Import Process:

Step 1

Choose Module

Step 2

Upload File

Step 3

Validate File

Step 4

Map Columns

Step 5

Preview Data

Step 6

Run Validation

Step 7

Import

Step 8

Show Summary

## USER EXPERIENCE OBJECTIVES

Import should feel:

Guided

Visual

Self-Explanatory

Recoverable

No technical knowledge required.

## FILE VALIDATION

Before processing:

Validate File Type

Validate File Size

Validate Required Columns

Validate Encoding

Validate Data Structure

## SUPPORTED FILE TYPES

CSV

XLSX

Future

ODS

JSON

XML

## CHARACTER ENCODING

Mandatory:

UTF-8

Support:

International Characters

Unicode

Special Symbols

Examples:

José

François

Müller

محمد

Vishwas

## IMPORT TEMPLATES

Users should be able to download:

Product Template

Customer Template

Supplier Template

Inventory Template

Opening Balance Template

## PRODUCT IMPORT

Required Fields:

Product Name

Selling Price

Optional Fields:

SKU

Barcode

Category

Cost Price

Description

Unit

Opening Quantity

Reorder Level

Tax Group

## CUSTOMER IMPORT

Required Fields:

Customer Name

Optional Fields:

Phone

Email

Address

Tax Number

Credit Limit

Opening Balance

Notes

## SUPPLIER IMPORT

Required Fields:

Supplier Name

Optional Fields:

Phone

Email

Address

Tax Number

Opening Balance

Notes

## INVENTORY IMPORT

Required Fields:

Product Identifier

Quantity

Optional Fields:

Warehouse

Batch Number

Location

Notes

## OPENING BALANCE IMPORT

Customer

Supplier

Ledger

Outstanding

Must create proper ledger entries.

Never direct balance updates.

## CATEGORY IMPORT

Product Categories

Expense Categories

Customer Categories

Supplier Categories

## COLUMN MAPPING SYSTEM

Critical Feature.

Users should map:

Source Columns

to

Sarang Fields

Example:

Excel Column

Product\_Name

↓

Sarang Field

Product Name

## AUTO-MAPPING

System should attempt:

Header Matching

Field Matching

Smart Suggestions

Example:

Product Name

Item Name

Item

Name

Map automatically when possible.

## PREVIEW SCREEN

Before import:

Display:

Record Count

Sample Records

Mapped Fields

Validation Results

Users must confirm before import.

## VALIDATION RULES

Run before import.

Validation Categories:

Required Fields

Duplicate Records

Data Types

Business Rules

Relationships

## PRODUCT VALIDATION

Check:

Name Exists

Price Valid

SKU Unique

Barcode Unique

Category Valid

## CUSTOMER VALIDATION

Check:

Name Exists

Phone Format

Email Format

Duplicate Detection

## SUPPLIER VALIDATION

Check:

Required Fields

Duplicate Detection

Tax Number Format

## INVENTORY VALIDATION

Check:

Product Exists

Quantity Valid

Location Valid

## DUPLICATE DETECTION

Types:

Exact Match

Potential Match

Examples:

ABC Traders

ABC Traders Pvt Ltd

Allow user decision.

## IMPORT MODES

Mode 1

Create Only

Mode 2

Create Or Update

Mode 3

Update Existing

Admin Only.

## ERROR HANDLING

Invalid records:

Do not stop entire import.

Strategy:

Import Valid Records

Skip Invalid Records

Generate Error Report

## ERROR REPORT

After import:

Display:

Imported

Skipped

Failed

Warnings

Allow export as:

CSV

PDF

## IMPORT SUMMARY

Display:

Total Records

Successful Records

Failed Records

Warnings

Duration

## TRANSACTION STRATEGY

Small Imports:

Single Transaction

Large Imports:

Batch Transactions

Purpose:

Avoid Partial Corruption

## ROLLBACK STRATEGY

Critical.

Before import:

Create Recovery Point

If catastrophic failure:

Rollback Import

Restore Previous State

## IMPORT AUDIT LOGGING

Every import should create:

Audit Entry

Timestamp

User

Module

Record Count

Result

## DATA MIGRATION PRINCIPLES

Never overwrite data silently.

Always:

Validate

Preview

Confirm

Log

## TALLY MIGRATION STRATEGY

Future Module.

Potential Imports:

Customers

Suppliers

Products

Ledgers

Outstanding

Stock

Use:

Exported Files Only

No direct Tally integration required in V1.

## BUSY MIGRATION STRATEGY

Future Module.

Use:

Excel Exports

CSV Exports

## VYAPAR MIGRATION STRATEGY

Future Module.

Use:

Exported Files

## QUICKBOOKS MIGRATION STRATEGY

Future Module.

Use:

CSV Exports

Excel Exports

## ZOHO MIGRATION STRATEGY

Future Module.

Use:

CSV Exports

Excel Exports

## GLOBALIZATION REQUIREMENTS

Follow:

LOCALIZATION\_AND\_GLOBALIZATION.md

Support:

Different Date Formats

Different Number Formats

Different Currency Formats

Unicode Data

## PERFORMANCE TARGETS

1,000 Records

< 5 Seconds

10,000 Records

< 30 Seconds

100,000 Records

Graceful Batch Processing

## SECURITY REQUIREMENTS

Validate:

File Type

File Content

File Size

Input Data

Permissions

Never execute imported content.

Never trust imported data.

## PERMISSION REQUIREMENTS

Admin

Manager

Allowed

Cashier

Staff

Denied

## BACKUP REQUIREMENTS

Before large imports:

Create Automatic Backup

Purpose:

Recovery

Rollback

Data Protection

## SUCCESS CRITERIA

A business owner should be able to:

Export data from existing software.

Import into Sarang.

Start using Sarang.

within minutes.

Without contacting Aszurex.

## ADOPTION OBJECTIVE

Migration should never be the reason a business rejects Sarang.

The easier migration becomes:

The faster adoption grows.

The faster trust grows.

The faster Aszurex credibility grows.

## FINAL PRINCIPLE

Businesses should not fear switching.

Businesses should not fear data loss.

Businesses should not fear complexity.

Migration should feel effortless.

## IMPORT ERROR CODES

All import errors must use codes from ERROR_CATALOG.md. The following are canonical codes for import-specific failures:

| Error Code | Situation | User Message |
|-----------|-----------|--------------|
| IMP-001 | File format not supported | "This file format is not supported. Please use CSV or Excel (.xlsx)." |
| IMP-002 | File is empty | "The uploaded file contains no data. Please check the file and try again." |
| IMP-003 | File is too large | "The file exceeds the maximum import size. Split it into smaller files." |
| IMP-004 | Required column missing | "Required column '[column name]' is missing from the file." |
| IMP-005 | Invalid data type in row | "Row [N]: '[field]' contains an invalid value." |
| IMP-006 | Duplicate record detected | "Row [N]: A [record type] with this [field] already exists." |
| IMP-007 | Referenced record not found | "Row [N]: [Product/Category] '[name]' was not found." |
| IMP-008 | Permission denied | "You do not have permission to import [module] data." |
| IMP-009 | Transaction failure | "Import failed during save. No records were changed. Please try again." |
| IMP-010 | Backup creation failed | "Could not create a safety backup before import. Import aborted." |

## CSV TEMPLATE SPECIFICATIONS

### Product Import Template (products_template.csv)

Required columns: `name, selling_price, unit`

Optional columns: `sku, barcode, purchase_price, tax_rate, category, description, reorder_level, initial_stock`

```csv
name,sku,selling_price,unit,tax_rate,initial_stock
Basmati Rice 5kg,SKU001,450.00,Bag,5,100
Wheat Flour 10kg,,560.00,Bag,0,50
```

### Customer Import Template (customers_template.csv)

Required columns: `name`

Optional columns: `phone, email, address, tax_number, credit_limit`

```csv
name,phone,email,address
Sharma Traders,9876543210,sharma@email.com,"123 MG Road, Bengaluru"
Patel Enterprises,9812345678,,
```

## IMPORT BATCH SIZE LIMITS

| Record Type | Max Records Per Import |
|-------------|----------------------|
| Products | 10,000 |
| Customers | 10,000 |
| Suppliers | 5,000 |
| Inventory (stock entries) | 50,000 |
| Opening balances | 10,000 |

Imports exceeding these limits must be split into multiple files. Show an error before processing starts.

Powered by Aszurex.

Trust Beyond Limits.
