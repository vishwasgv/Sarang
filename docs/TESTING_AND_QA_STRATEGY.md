# TESTING_AND_QA_STRATEGY.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Testing & Quality Assurance Strategy

## PURPOSE

This document defines:

- Testing Philosophy
- Quality Standards
- Test Types
- Test Coverage
- Release Validation
- Regression Testing
- Acceptance Criteria

The objective is to ensure Sarang remains:

Reliable

Stable

Trustworthy

Predictable

Low Maintenance

## CORE PHILOSOPHY

For Sarang:

Trust is the product.

A bug that causes incorrect invoices, stock levels, tax calculations, or backups can destroy trust instantly.

Every release must prioritize:

Data Integrity

Business Continuity

Reliability

Accuracy

before introducing new features.

## QUALITY OBJECTIVES

Every release should:

Protect User Data

Protect Business Records

Protect Financial Records

Protect Inventory Data

Protect Reports

Protect Backups

Protect User Trust

## TESTING PYRAMID

Level 1

Unit Tests

Level 2

Integration Tests

Level 3

Workflow Tests

Level 4

Manual Validation

Level 5

Release Certification

## TEST CATEGORIES

Mandatory Categories:

Authentication

Authorization

Billing

Inventory

Customers

Suppliers

Expenses

Reports

Analytics

Backup

Restore

Printing

Exports

Imports

Database Migrations

Industry Templates

## CRITICAL BUSINESS WORKFLOWS

These workflows must pass before every release.

## BILLING WORKFLOW

Create Invoice

Add Products

Apply Discounts

Apply Taxes

Generate Total

Save Invoice

Print Invoice

Export Invoice

Validation:

Totals Correct

Taxes Correct

Discounts Correct

Invoice Number Generated

Inventory Updated

Reports Updated

## INVENTORY WORKFLOW

Create Product

Add Stock

Reduce Stock

Adjust Stock

Transfer Stock

Return Stock

Validation:

Stock Accurate

Movements Logged

Reports Updated

No Negative Quantities Unless Allowed

## CUSTOMER WORKFLOW

Create Customer

Update Customer

Credit Sale

Payment Collection

Outstanding Tracking

Validation:

Ledger Accurate

Balances Accurate

Reports Accurate

## SUPPLIER WORKFLOW

Create Supplier

Purchase Order

Inventory Update

Supplier Ledger Update

Validation:

Supplier Balance Accurate

Inventory Accurate

Reports Accurate

## EXPENSE WORKFLOW

Create Expense

Categorize Expense

Update Reports

Update Analytics

Validation:

Expense Totals Correct

Reports Updated

## TAX TESTING

Support:

GST

VAT

Sales Tax

Custom Tax

No Tax

Validation:

Tax Calculation

Tax Reports

Tax Exports

Tax Display

Tax Rounding

Tax Totals

## CURRENCY TESTING

Support:

All ISO-4217 currencies.

Examples:

USD

EUR

GBP

INR

AUD

CAD

AED

SAR

SGD

Validation:

Formatting

Symbols

Decimal Handling

Rounding Rules

Reports

Invoices

Exports

## GLOBALIZATION TESTING

Validate:

Date Formats

Time Formats

Currency Formats

Tax Labels

Number Formats

Timezone Handling

Examples:

MM/DD/YYYY

DD/MM/YYYY

YYYY-MM-DD

## REPORT TESTING

Mandatory Reports:

Sales

Inventory

Expenses

Tax

Customer Ledger

Supplier Ledger

Outstanding

Analytics

Audit

Backup

Validation:

Accurate Data

Correct Totals

Correct Filters

Correct Exports

## ANALYTICS TESTING

Validate:

Revenue Trends

Expense Trends

Inventory Value

Outstanding Amounts

Top Products

Dashboard KPIs

Validation:

Numbers Match Source Data

No Calculation Drift

## BACKUP TESTING

Critical.

Test:

Manual Backup

Automatic Backup

Pre-Update Backup

Restore

Rollback

Validation

Integrity Checks

Validation:

No Data Loss

Successful Restore

Version Compatibility

## DISASTER RECOVERY TESTING

Validate:

Crash Recovery

Power Failure Recovery

Database Corruption Recovery

Migration Failure Recovery

Update Failure Recovery

Goal:

Recover Data Safely

## IMPORT TESTING

Formats:

CSV

Excel

JSON (Future)

Database Backup

Validation:

Data Mapping

Validation Rules

Error Handling

Large Files

Duplicate Records

## EXPORT TESTING

Formats:

PDF

CSV

Excel

Validation:

Correct Data

Correct Formatting

Correct Branding

Readable Output

## PRINTING TESTING

Support:

58mm Thermal

80mm Thermal

A4

PDF

Validation:

Alignment

Margins

Tax Display

Totals

QR Codes

Readability

## UPI QR TESTING

Validate:

QR Generation

Amount Encoding

UPI ID Encoding

Merchant Name

Invoice Reference

Important:

Do NOT verify payments.

Do NOT process payments.

Only validate QR generation.

## AUTHENTICATION TESTING

Validate:

Login

Logout

Password Hashing

Session Expiry

Password Changes

Inactive Users

## AUTHORIZATION TESTING

Roles:

Admin

Manager

Cashier

Staff

Kitchen Staff

Validate:

Permissions

Restricted Actions

Role Boundaries

Access Control

## SECURITY TESTING

Validate:

IPC Security

Input Validation

Database Access

File Access

Permission Enforcement

Session Security

Follow:

SECURITY.md

## DATABASE TESTING

Validate:

Migrations

Indexes

Relationships

Foreign Keys

Integrity Checks

Schema Versioning

## INDUSTRY TEMPLATE TESTING

Templates:

Restaurant

Retail

Hardware

Distributor

Validation:

Template Configuration

Dashboard Configuration

Reports

Industry Features

Navigation

## PERFORMANCE TESTING

Startup Time

Search Performance

Invoice Creation

Report Generation

Backup Creation

Restore Operations

Targets:

Startup < 3 Seconds

Report Generation < 3 Seconds

Database Queries < 100ms (where practical)

## STRESS TESTING

Validate:

10,000 Products

100,000 Invoices

Large Reports

Large Backups

Large Customer Databases

Goal:

Remain Stable

Remain Responsive

## UI TESTING

Validate:

Navigation

Forms

Tables

Search

Filters

Animations

Responsiveness

Accessibility

Follow:

UI\_UX\_SYSTEM.md

## REGRESSION TESTING

Before every release:

Billing

Inventory

Reports

Backups

Printing

Permissions

must be retested.

## RELEASE CERTIFICATION

No release should ship until:

All Critical Tests Pass

No Data Loss Risks

No Security Risks

No Migration Risks

No Backup Risks

## TEST ENVIRONMENTS

Environment 1:

Development

Environment 2:

QA

Environment 3:

Release Candidate

Environment 4:

Production Build Validation

## ACCEPTANCE CRITERIA

A release is acceptable only if:

Invoices are accurate.

Inventory is accurate.

Reports are accurate.

Backups work.

Restore works.

Printing works.

Permissions work.

Data remains intact.

## BUG PRIORITY SYSTEM

Priority 1

Data Loss

Corruption

Security Failure

Backup Failure

Priority 2

Billing Errors

Inventory Errors

Report Errors

Tax Errors

Priority 3

UI Issues

Performance Issues

Minor Bugs

Priority 4

Cosmetic Issues

Typos

Minor Improvements

## AUTOMATION STRATEGY

Automate:

Unit Tests

Integration Tests

Regression Tests

Migration Tests

Validation Tests

Manual Testing:

Printing

UX

Industry Workflows

Recovery Testing

## SUCCESS DEFINITION

Success is not:

More Features.

Success is:

Reliable Features.

A business owner should trust Sarang with years of business data.

That trust should never be compromised.

## FINAL QUALITY PRINCIPLE

Every release should answer:

"Would I trust this release with my own business?"

If the answer is not:

YES

Do not release it.

Protect Data.

Protect Accuracy.

Protect Trust.

## TESTING TOOLS AND FRAMEWORKS

### Unit Testing
**Tool:** Vitest (vite-native, faster than Jest for this stack)

```bash
# Run all unit tests
npx vitest run

# Watch mode
npx vitest watch

# Coverage report
npx vitest run --coverage
```

Key packages:
- `vitest` — test runner
- `@vitest/coverage-v8` — coverage provider
- `@testing-library/react` — React component testing utilities
- `@testing-library/user-event` — User interaction simulation

### Component Testing
**Tool:** @testing-library/react + Vitest

```typescript
// Example: Test that InvoiceForm renders with required fields
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceForm } from '../components/InvoiceForm';

test('invoice form shows error when submitted without items', async () => {
  render(<InvoiceForm />);
  fireEvent.click(screen.getByText('Create Invoice'));
  expect(await screen.findByText('Add at least one item')).toBeInTheDocument();
});
```

### Integration Testing
**Tool:** Vitest + Prisma + SQLite in-memory

```typescript
// Example: Test billing service creates inventory movement
test('creating invoice reduces product stock', async () => {
  await inventoryService.addStock({ product_id: 1, quantity: 10, ... });
  await billingService.createInvoice({ items: [{ product_id: 1, quantity: 3, ... }] });
  const inventory = await inventoryService.getInventory(1);
  expect(inventory.data.quantity).toBe(7);
});
```

### End-to-End Testing
**Tool:** Playwright

```bash
# Run E2E tests
npx playwright test

# Run specific test file
npx playwright test tests/billing.spec.ts

# Headed mode (see browser)
npx playwright test --headed
```

Key E2E scenarios:
- Full invoice creation and payment workflow
- Backup creation and restore
- Permission enforcement (login as Cashier, attempt admin actions)
- Industry template switching

### Code Coverage Targets

| Layer | Minimum Coverage | Critical Coverage |
|-------|-----------------|-------------------|
| Service Layer (business logic) | 80% | 100% for billing, inventory |
| Utility Functions | 90% | 100% for tax calculation |
| IPC Handlers | 70% | — |
| React Components | 60% | 80% for billing forms |
| Overall | 70% | — |

### Pre-Release Test Checklist (Automated)

```bash
# Must all pass before release:
npx vitest run                    # Unit + integration tests
npx playwright test               # E2E tests
npx tsc --noEmit                  # TypeScript compilation check
npx eslint src/                   # Lint check
npx electron-builder --dir        # Build without packaging (fast)
```

### Pre-Release Manual Test Protocol

1. Full billing workflow: add product → create invoice → record payment → print
2. Inventory: add stock → create invoice → verify quantity reduced
3. Backup: create → validate → restore → verify data intact
4. Permissions: login as Cashier → verify admin features are blocked
5. Industry template switch: change template → verify dashboard changes
6. Tax calculation: verify GST/VAT totals on invoice match manual calculation

Powered by Aszurex.

Trust Beyond Limits.
