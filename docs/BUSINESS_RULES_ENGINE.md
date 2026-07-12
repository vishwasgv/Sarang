# BUSINESS_RULES_ENGINE.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Business Rules Engine Specification

## PURPOSE

This document defines:

- Core Business Rules
- Validation Rules
- Workflow Rules
- Data Integrity Rules
- Financial Rules
- Inventory Rules
- User Rules
- Industry Rules

The objective is to ensure:

Consistency

Accuracy

Predictability

Data Integrity

Business Trust

## CORE PRINCIPLE

Every business action must follow defined rules.

Rules must be enforced in:

Service Layer

Database Layer

Workflow Layer

Never rely on UI validation alone.

## RULE ENGINE PHILOSOPHY

Business Rules should be:

Centralized

Configurable

Auditable

Reusable

Testable

## RULE CATEGORIES

Global Rules

User Rules

Inventory Rules

Billing Rules

Payment Rules

Customer Rules

Supplier Rules

Expense Rules

Tax Rules

Industry Rules

Backup Rules

Reporting Rules

## GLOBAL RULES

## RULE G001

Every record must have:

Created Date

Updated Date

Created By

(where applicable)

## RULE G002

Soft delete preferred.

Avoid permanent deletion.

## RULE G003

Critical actions require audit logging.

Examples:

Invoice Cancellation

Inventory Adjustments

User Deactivation

Settings Changes

Restore Operations

## RULE G004

All monetary values must use configured currency formatting.

## RULE G005

Business data belongs to the user.

No automatic transmission.

## USER RULES

## RULE U001

Username must be unique.

## RULE U002

Password must be stored as hash.

Never plaintext.

## RULE U003

Inactive users cannot login.

## RULE U004

Users cannot perform actions without required permissions.

## RULE U005

At least one Admin must always exist.

Prevent deleting last Admin.

## ROLE RULES

## RULE R001

Permissions assigned through roles.

## RULE R002

Direct permission overrides should be avoided in V1.

## RULE R003

Only Admin can:

Restore Backups

Manage Roles

Delete Users

Change Critical Settings

## PRODUCT RULES

## RULE P001

Product Name required.

## RULE P002

SKU should be unique when enabled.

## RULE P003

Barcode should be unique when enabled.

## RULE P004

Selling Price cannot be negative.

## RULE P005

Cost Price cannot be negative.

## RULE P006

Archived products cannot be sold.

## INVENTORY RULES

Critical.

## RULE I001

Every inventory change requires movement record.

## RULE I002

Inventory quantity cannot become negative.

Default Rule.

## RULE I003

Negative inventory allowed only if:

Business setting explicitly enables it.

## RULE I004

Inventory movements must be auditable.

## RULE I005

Stock adjustments require reason.

## RULE I006

Deleting inventory history is prohibited.

## RULE I007

Inventory valuation must use configured method.

Version 1:

Average Cost

## BILLING RULES

Mission Critical.

## RULE B001

Invoice Number must be unique.

## RULE B002

Invoice must contain at least one line item.

## RULE B003

Quantity must be greater than zero.

## RULE B004

Unit Price cannot be negative.

## RULE B005

Invoice Total cannot be negative.

## RULE B006

Invoice must calculate:

Subtotal

Discount

Tax

Round Off

Grand Total

## RULE B007

Invoice creation must update inventory.

Where applicable.

## RULE B008

Invoice creation must create audit log.

## RULE B009

Printed invoice cannot be deleted.

Recommended Action:

Cancel Invoice

Not Delete Invoice

## RULE B010

Cancelled invoices remain visible.

Audit Trail Required.

## RULE B011

Invoice modifications after finalization should be restricted.

Recommended:

Cancel & Reissue

## PAYMENT RULES

## RULE PM001

Payment amount cannot be negative.

## RULE PM002

Recorded payment cannot exceed outstanding amount.

Configurable.

## RULE PM003

Payment records must remain auditable.

## RULE PM004

Payment reversal requires audit log.

## RULE PM005

Sarang records payments.

Sarang does not verify payments.

## CUSTOMER RULES

## RULE C001

Customer name required.

## RULE C002

Customer balances calculated from ledger.

Never manually edited.

## RULE C003

Outstanding balance must always match ledger.

## RULE C004

Credit limit enforcement configurable.

## RULE C005

Customer deletion prohibited if transactions exist.

Use archive instead.

## SUPPLIER RULES

## RULE S001

Supplier balances calculated from ledger.

## RULE S002

Supplier deletion prohibited if transactions exist.

## RULE S003

Outstanding amounts calculated automatically.

## PURCHASE ORDER RULES

## RULE PO001

PO Number must be unique.

## RULE PO002

Approved PO cannot be edited.

## RULE PO003

Received PO updates inventory.

## RULE PO004

Cancelled PO remains auditable.

## EXPENSE RULES

## RULE E001

Expense amount must be positive.

## RULE E002

Expense category required.

## RULE E003

Expense deletion requires audit log.

## TAX RULES

## RULE T001

Tax rate cannot be negative.

## RULE T002

Tax calculation rules configurable.

## RULE T003

Support:

GST

VAT

Sales Tax

Custom Tax

No Tax

## RULE T004

Tax calculations rounded according to local configuration.

## CURRENCY RULES

## RULE CUR001

All calculations use base currency.

## RULE CUR002

Display formatting follows locale.

## RULE CUR003

Currency symbol determined by configuration.

## REPORTING RULES

## RULE REP001

Reports must derive data from source records.

## RULE REP002

Reports must not contain manually altered values.

## RULE REP003

Revenue reports must match invoice totals.

## RULE REP004

Outstanding reports must match ledger balances.

## ANALYTICS RULES

## RULE AN001

Analytics must derive from source data.

## RULE AN002

Dashboard KPIs must match reports.

## RULE AN003

No hidden calculations.

All formulas documented.

## BACKUP RULES

Critical.

## RULE BK001

Backup must pass validation before completion.

## RULE BK002

Restore must create safety backup first.

## RULE BK003

Pre-update backup mandatory.

## RULE BK004

Migration backup mandatory.

## RULE BK005

Backup metadata required.

## RESTORE RULES

## RULE RS001

Restore operation must be auditable.

## RULE RS002

Restore requires Admin permission.

## RULE RS003

Restore creates audit log.

## IMPORT RULES

## RULE IMP001

Imported files validated before processing.

## RULE IMP002

Required fields must exist.

## RULE IMP003

Invalid records rejected.

## RULE IMP004

Import summary generated.

## EXPORT RULES

## RULE EXP001

Exports must preserve data integrity.

## RULE EXP002

Exports must use UTF-8 encoding.

## RULE EXP003

Exports must include headers.

## SECURITY RULES

## RULE SEC001

Permission check required before sensitive actions.

## RULE SEC002

All IPC requests validated.

## RULE SEC003

Database access only through services.

## RULE SEC004

No direct database access from UI.

## INDUSTRY RULES

## RESTAURANT RULES

## RULE RES001

KOT must belong to valid invoice.

## RULE RES002

Recipe consumption updates inventory.

## RULE RES003

Closed orders cannot be modified.

## RETAIL RULES

## RULE RET001

Barcode uniqueness enforced.

## RULE RET002

Returns create inventory movement.

## HARDWARE RULES

## RULE HW001

Area pricing calculations validated.

## RULE HW002

Measurement units configurable.

## DISTRIBUTOR RULES

## RULE DIS001

Credit limits configurable.

## RULE DIS002

Outstanding tracking mandatory.

## AUDIT RULES

## RULE AUD001

Critical actions logged.

## RULE AUD002

Audit logs cannot be edited.

## RULE AUD003

Audit logs cannot be deleted.

## CONFIGURATION RULES

## RULE CFG001

Country configurable.

## RULE CFG002

Currency configurable.

## RULE CFG003

Tax model configurable.

## RULE CFG004

Business type configurable.

## FUTURE RULE ENGINE DESIGN

Future Architecture:

Rule

Condition

Action

Priority

Enabled

Example:

IF Outstanding > Credit Limit

THEN Block Invoice

Priority = High

Allows future:

Custom Rules

Industry Rules

Enterprise Rules

Automation Rules

## RULE VIOLATION HANDLING

When rule violated:

Reject Action

Display Friendly Message

Log Event

Protect Data Integrity

Example:

Instead of:

"Database Constraint Failed"

Show:

"Stock cannot become negative."

## SUCCESS CRITERIA

The Business Rules Engine should guarantee:

Accurate Invoices

Accurate Inventory

Accurate Ledgers

Accurate Reports

Accurate Analytics

Reliable Backups

Predictable Workflows

## FINAL PRINCIPLE

Features create interest.

Business rules create trust.

A business owner should never have to wonder:

"Can I trust these numbers?"

The answer should always be:

Yes.

## RULE DEPENDENCY MAP

Critical rules that depend on each other:

```
RULE B001 (Unique invoice number)
  Required by: RULE REP001 (Reports derive from source records)
  Enforced by: Database UNIQUE constraint + Service validation

RULE I001 (Every inventory change requires movement record)
  Required by: RULE I004 (Movements must be auditable)
  Required by: RULE AN001 (Analytics derive from source data)
  Triggers:    RULE G003 (Critical actions require audit log)
  Enforced by: Service layer transaction (atomic)

RULE B007 (Invoice creation must update inventory)
  Depends on:  RULE I001 (Movement record must be created)
  Depends on:  RULE I002 (Cannot go negative — default)
  Runs inside: Single database transaction (atomicity required)

RULE PM005 (Record only, never verify)
  Constrains:  ALL payment UI copy and labels
  Constrains:  ALL service layer payment functions
  Constrains:  ALL AI coding agents working on Sarang
  Note:        Cannot be disabled or configured away

RULE BK001 (Backup validation before completion)
  Validates:   SHA-256 checksum integrity
  Gate for:    Restore operations (RS-001, RS-002)
```

## RULE CONFLICT RESOLUTION PRIORITY

When rules appear to conflict, apply this priority order:

**1. Security Rules (SEC001–SEC004)** — Always enforced. No bypass possible.

**2. Payment Rules (PM001–PM005)** — PM005 is absolute. PM002 may be configured by Admin only.

**3. Data Integrity Rules (B001–B011, I001–I007)** — Not bypassable in normal operation. Exception: I003 allows Admin to enable negative inventory.

**4. Permission Rules (U004, R003)** — Enforced at UI + IPC + Service + Database layers.

**5. Configuration Rules (CFG001–CFG004)** — User-adjustable defaults. Override defaults but not higher-priority rules.

**6. Operational Rules (C001–C005, S001–S003, E001–E003)** — Enforced by default. Admin-configurable exceptions in specific scenarios.

### Example Resolutions

**I002 (no negative stock) vs backorder need:**
Resolution: Admin enables "Allow Negative Inventory" in Settings. RULE I003 explicitly permits this. I003 overrides I002 only when Admin explicitly enables it.

**B009 (printed invoice cannot be deleted) vs user request:**
Resolution: B009 is absolute. Use Cancel Invoice (see B010). Data preservation outweighs user convenience.

**PM002 (payment cannot exceed outstanding) vs advance payment:**
Resolution: Admin enables "Allow Advance Payment" in customer settings. The flag is the gate — not PM002 itself.

## RULE ENFORCEMENT LAYERS

Rules are enforced at three independent layers — any single layer failure is backstopped by the next:

**Layer 1 — UI Layer** (convenience, not security)
Hides inaccessible actions. Shows inline validation. Client-side Zod schemas. Does NOT prevent bypass.

**Layer 2 — Service Layer** (primary rule enforcement)
`requirePermission()` before every sensitive IPC call. Business rule checks inside service functions. Database transactions for multi-step operations. Audit log creation.

**Layer 3 — Database Layer** (final backstop)
UNIQUE constraints, NOT NULL constraints, FOREIGN KEY ON DELETE RESTRICT, Prisma schema enforcement.

If Layer 1 fails → Layer 2 blocks.
If Layer 2 fails → Layer 3 prevents data corruption.
Never rely on Layer 1 alone for security.

Powered by Aszurex.

Trust Beyond Limits.
