# DEVELOPMENT_RULES.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Engineering & Development Standards

## PURPOSE

This document defines:

- Coding Standards
- Architecture Rules
- Development Principles
- Quality Standards
- Testing Requirements
- Documentation Requirements
- Dependency Policies
- Release Standards

All development must comply with this document.

## CORE DEVELOPMENT PHILOSOPHY

Every technical decision must support:

Offline First

Privacy First

Ownership First

Simplicity

Maintainability

Reliability

Scalability

Minimal Support Burden

Minimal Operational Burden

## PRIMARY OBJECTIVE

Build software that:

Works reliably.

Is easy to maintain.

Is easy to extend.

Requires minimal support.

Demonstrates engineering excellence.

## DEVELOPMENT PRINCIPLES

## RULE 1

SIMPLE IS BETTER

Avoid complexity whenever possible.

If two solutions exist:

Choose the simpler solution.

## RULE 2

CONFIGURATION OVER CUSTOM CODE

Prefer:

Configuration

Templates

Feature Flags

Settings

Over:

Duplicated logic

Separate implementations

Hardcoded behavior

## RULE 3

REUSE BEFORE BUILDING

Before creating:

Component

Service

Module

Utility

Ask:

Can this be reused?

## RULE 4

BUILD FOR MAINTENANCE

Future developers should understand the code quickly.

Code should be:

Predictable

Readable

Documented

Modular

## TECHNOLOGY STANDARDS

Desktop:

Electron

Frontend:

React

TypeScript

Styling:

TailwindCSS

Animations:

Framer Motion

Database:

SQLite

ORM:

Prisma

Runtime:

Node.js

## TYPESCRIPT RULES

Use TypeScript everywhere.

No new JavaScript files unless absolutely necessary.

All public interfaces must be typed.

Avoid:

any

unknown shortcuts

unsafe casting

## ARCHITECTURE RULES

Use layered architecture.

## PRESENTATION LAYER

Responsibilities:

UI

Screens

Forms

Charts

Navigation

## APPLICATION LAYER

Responsibilities:

Business Workflows

Validation

Permissions

Use Cases

## DOMAIN LAYER

Responsibilities:

Products

Inventory

Customers

Suppliers

Billing

Tax

Reports

Analytics

Industry Templates

## DATA LAYER

Responsibilities:

Database

Persistence

Backups

Queries

Migrations

## MODULE RULES

Every module must contain:

Types

Services

Validation

UI Components

Tests

Documentation

## SHARED COMPONENT POLICY

Reusable components belong in:

shared/

Examples:

Buttons

Tables

Cards

Inputs

Dialogs

Icons

Charts

Badges

Tooltips

## UI RULES

All UI must follow:

UI\_UX\_SYSTEM.md

No custom styling outside design system unless approved.

## DESIGN SYSTEM RULES

Use:

Design Tokens

Shared Components

Theme Variables

Reusable Layouts

Avoid:

Inline Styles

Random Colors

Custom Spacing

Inconsistent Typography

## DATABASE RULES

Database:

SQLite

All access through service layer.

Frontend must never directly access database.

## MIGRATION RULES

All schema changes:

Must use Prisma Migrations.

No manual database modifications.

## DATA INTEGRITY RULES

Validate before insert.

Validate before update.

Validate before delete.

Prevent:

Corrupted records

Negative inventory

Invalid dates

Invalid currency values

Invalid tax values

## VALIDATION RULES

Every form requires:

Client Validation

Server Validation

Business Validation

Never trust UI alone.

## ERROR HANDLING RULES

Never expose technical errors to users.

Bad:

"Unhandled Exception"

Good:

"Something went wrong. Please try again."

## LOGGING RULES

Version 1:

Local Logging Only

No remote logging.

No automatic reporting.

No telemetry.

No analytics collection.

## PERFORMANCE RULES

Application Startup:

< 3 Seconds

Search:

Instant

Invoice Generation:

Instant

Report Generation:

< 3 Seconds

Database Queries:

< 100ms where practical

## MEMORY RULES

Avoid unnecessary memory usage.

Dispose listeners.

Clean subscriptions.

Avoid memory leaks.

## SECURITY RULES

Follow:

SECURITY.md

Mandatory:

Context Isolation

Sandboxing

Restricted IPC

Input Validation

Permission Checks

Audit Logs

No unsafe Node exposure.

## AUTHENTICATION RULES

Passwords:

bcrypt or Argon2

Never store plaintext.

Never log passwords.

Never expose secrets.

## AUTHORIZATION RULES

Every action must check permissions.

Examples:

Delete Product

Modify Inventory

Restore Backup

View Reports

Manage Users

Change Settings

## BACKUP RULES

Every release must preserve:

Backup Compatibility

Restore Compatibility

Data Integrity

Never break existing backups.

## IMPORT RULES

Validate:

CSV

Excel

JSON

Database Imports

Reject malformed files.

## EXPORT RULES

Support:

PDF

Excel

CSV

Exports must be:

Readable

Professional

Consistent

## PRINTING RULES

Support:

58mm

80mm

A4

PDF

Print Preview

All templates reusable.

## INDUSTRY TEMPLATE RULES

Industry templates must:

Reuse core engine.

Avoid duplicate logic.

Use configuration.

Use feature flags.

Never create separate codebases.

## TESTING REQUIREMENTS

Every release must test:

Authentication

Permissions

Inventory

Billing

Reports

Backups

Imports

Exports

Printing

Tax Calculations

Currency Formatting

Industry Templates

## TEST TYPES

Unit Tests

Integration Tests

Workflow Tests

Manual Validation

## REGRESSION TESTING

Before release:

Billing

Inventory

Reports

Backups

Printing

must always be tested.

## DOCUMENTATION REQUIREMENTS

Every feature requires:

Purpose

Usage

Configuration

Known Limitations

## REQUIRED DOCUMENTS

README

INSTALLATION\_GUIDE

BACKUP\_GUIDE

RESTORE\_GUIDE

USER\_GUIDE

CHANGELOG

PRIVACY\_POLICY

TERMS\_OF\_USE

DISCLAIMER

## CODE REVIEW RULES

Before merging:

Readable

Tested

Typed

Documented

Reusable

Secure

## DEPENDENCY POLICY

Use:

Actively Maintained Packages

Minimal Dependencies

Open Source Preferred

Avoid:

Abandoned Packages

Heavy Packages

Unnecessary Packages

## RELEASE STRATEGY

Versioning:

Semantic Versioning

Example:

1.0.0

1.1.0

1.2.0

2.0.0

## RELEASE CHECKLIST

Before Release:

Tests Pass

Build Passes

Printing Works

Reports Work

Backups Work

Restore Works

Exports Work

Documentation Updated

## USER TRUST RULE

Every release should improve:

Reliability

Usability

Performance

Security

Trust

Never sacrifice trust for features.

## SUPPORT REDUCTION RULE

Before building any feature ask:

Will this increase support burden?

If yes:

Reconsider.

The software should be self-service first.

## LEGAL RISK RULE

Never build features that require:

Payment Processing

Holding Funds

User Tracking

Data Collection

Cloud Storage

Regulatory Approvals

Unless future strategy changes.

## AI DEVELOPMENT RULES

If using:

Claude

Cursor

Gemini

Copilot

ChatGPT

Windsurf

or any AI coding system:

AI generated code must:

Be reviewed.

Be tested.

Be documented.

Never merge AI code blindly.

## FINAL ENGINEERING PRINCIPLE

Every line of code should support:

Trust

Reliability

Privacy

Ownership

Simplicity

Maintainability

Scalability

Professionalism

If a feature does not contribute to those goals:

Do not build it.

## CODE EXAMPLES: CORRECT VS INCORRECT PATTERNS

### RULE: No business logic in components

❌ INCORRECT — Business logic in UI component:
```typescript
// BAD: Tax calculation in a React component
function InvoiceForm() {
  const total = items.reduce((sum, item) => {
    const tax = item.price * (item.taxRate / 100);
    return sum + item.price + tax;
  }, 0);
}
```

✅ CORRECT — Business logic in service layer:
```typescript
// GOOD: Tax calculation in billing service
// src/main/services/billing.service.ts
export function calculateInvoiceTotals(items: InvoiceItem[]): InvoiceTotals {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const taxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

// GOOD: Component just calls service
function InvoiceForm() {
  const totals = calculateInvoiceTotals(items);
}
```

### RULE: No direct database access from frontend

❌ INCORRECT — Frontend touching the database:
```typescript
// BAD: Using Prisma directly in a React component
import { prisma } from '../database/db';
function ProductList() {
  const products = await prisma.product.findMany();
}
```

✅ CORRECT — Frontend calls IPC, main process handles DB:
```typescript
// GOOD: Renderer calls through IPC bridge
// src/renderer/pages/ProductList.tsx
const products = await window.sarangAPI.products.getAll();

// GOOD: Main process handles the database call
// src/main/ipc/product.handlers.ts
ipcMain.handle('products:getAll', async () => {
  return await productService.getAll();
});
```

### RULE: Always check permissions before sensitive actions

❌ INCORRECT — Action without permission check:
```typescript
// BAD: Deleting without checking role
ipcMain.handle('product:delete', async (event, id) => {
  return await productService.delete(id);
});
```

✅ CORRECT — Permission checked before execution:
```typescript
// GOOD: Permission guard first
ipcMain.handle('product:delete', async (event, id) => {
  requirePermission(event, 'delete_product'); // throws if not allowed
  return await productService.delete(id);
});
```

### RULE: Input validation before database insertion

❌ INCORRECT — Direct insertion without validation:
```typescript
// BAD: No validation before inserting
ipcMain.handle('customer:create', async (event, data) => {
  return await prisma.customer.create({ data });
});
```

✅ CORRECT — Validate with Zod schema first:
```typescript
// GOOD: Zod validation at boundary
const CustomerCreateSchema = z.object({
  customer_name: z.string().min(1).max(200),
  phone: z.string().regex(/^\+?[\d\s-]{7,15}$/).optional(),
  email: z.string().email().optional(),
  credit_limit: z.number().min(0).default(0),
});

ipcMain.handle('customer:create', async (event, data) => {
  requirePermission(event, 'create_customer');
  const validated = CustomerCreateSchema.parse(data); // throws on invalid
  return await customerService.create(validated);
});
```

### RULE: Friendly error messages — never expose technical errors

❌ INCORRECT — Raw exception to user:
```typescript
// BAD: Error boundary that shows stack traces
catch (err) {
  return { error: err.message }; // "SQLITE_CONSTRAINT: UNIQUE constraint failed: products.sku"
}
```

✅ CORRECT — Mapped friendly error:
```typescript
// GOOD: Map to friendly message using ERROR_CATALOG.md codes
catch (err) {
  if (err.code === 'P2002') { // Prisma unique constraint
    return { error: 'INV-003', message: 'A product with this SKU already exists. Use a different SKU.' };
  }
  logger.error('product:create failed', err);
  return { error: 'SYS-001', message: 'Something went wrong. Please try again.' };
}
```

### RULE: TypeScript — no `any` type

❌ INCORRECT:
```typescript
function processPayment(data: any): any {
  return data;
}
```

✅ CORRECT:
```typescript
interface PaymentRecord {
  invoice_id: number;
  amount: number;
  payment_method: 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'CREDIT';
  payment_date: string;
}

function recordPayment(data: PaymentRecord): Promise<PaymentRecord> {
  return paymentService.record(data);
}
```

## MODULE STRUCTURE TEMPLATE

Every feature module must follow this structure:

```
src/
  main/
    services/
      [module].service.ts       ← All business logic
    ipc/
      [module].handlers.ts      ← IPC registration + permission checks
    validators/
      [module].validator.ts     ← Zod schemas
  renderer/
    pages/
      [Module]/
        index.tsx               ← Page component
        [Module]Form.tsx        ← Create/Edit form
        [Module]Table.tsx       ← Data table
    hooks/
      use[Module].ts            ← Data fetching hook
    store/
      [module].store.ts         ← Zustand store slice
  shared/
    types/
      [module].types.ts         ← Shared TypeScript interfaces
```

## AUDIT LOG REQUIREMENT

Every state-changing operation must create an audit log entry.

Operations that MUST be logged:
- Create, Update, Delete on any business entity
- Login and Logout
- Permission changes
- Settings changes
- Backup creation and restore
- Price changes on products
- Inventory adjustments
- User creation and deactivation

Audit log entry must capture:
- `user_id`: who performed the action
- `action`: what was done (CREATE_PRODUCT, UPDATE_PRICE, etc.)
- `entity_type`: which entity type
- `entity_id`: which specific record
- `old_value`: JSON of previous state (for updates/deletes)
- `new_value`: JSON of new state (for creates/updates)
- `created_at`: when it happened

## FINAL DEVELOPMENT OBJECTIVE

Sarang should become:

A world-class offline-first Business Operating System.

A demonstration of engineering excellence.

A demonstration of design excellence.

A demonstration of operational excellence.

A long-term credibility engine for Aszurex.

Built to last.

Powered by Aszurex.

Trust Beyond Limits.
