# PERMISSIONS_MATRIX.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Roles & Permissions Matrix

## PURPOSE

This document defines:

- User Roles
- Access Levels
- Permission Matrix
- Security Boundaries
- Module Access Rules
- Industry Role Extensions

The objective is to ensure:

Security

Data Integrity

Accountability

Auditability

Operational Control

## CORE PHILOSOPHY

Permissions should follow:

Least Privilege Principle

Users receive only the permissions required for their responsibilities.

## ROLE HIERARCHY

Level 1

Admin

Level 2

Manager

Level 3

Cashier

Level 4

Staff

Level 5

Kitchen Staff (Restaurant)

Future:

Supervisor

Auditor

Accountant

Warehouse Staff

Branch Manager

## ROLE DEFINITIONS

## ADMIN

Full system access.

Responsible for:

Business Configuration

Users

Permissions

Backups

System Settings

Security

## MANAGER

Operational control.

Responsible for:

Sales

Inventory

Reports

Customers

Suppliers

Expenses

Cannot:

Restore backups

Manage roles

Delete users

Modify security settings

## CASHIER

Billing focused.

Responsible for:

Invoices

Payments

Customers

Basic Reports

Cannot:

Modify inventory directly

View sensitive analytics

Manage users

## STAFF

Operational support role.

Responsible for:

Viewing information

Limited updates

Day-to-day operations

## KITCHEN STAFF

Restaurant-only role.

Responsible for:

Viewing KOTs

Updating order status

Managing kitchen workflow

Cannot access financial data.

## PERMISSION CATEGORIES

Authentication

Users

Roles

Customers

Suppliers

Products

Inventory

Billing

Payments

Expenses

Reports

Analytics

Backup

Restore

Settings

Audit Logs

Exports

Printing

Industry Features

## AUTHENTICATION PERMISSIONS

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

Login

Yes

Yes

Yes

Yes

Yes

Logout

Yes

Yes

Yes

Yes

Yes

Change Own Password

Yes

Yes

Yes

Yes

Yes

View Own Profile

Yes

Yes

Yes

Yes

Yes

## USER MANAGEMENT

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View Users

Yes

Yes

No

No

No

Create Users

Yes

No

No

No

No

Update Users

Yes

No

No

No

No

Disable Users

Yes

No

No

No

No

Delete Users

Yes

No

No

No

No

Assign Roles

Yes

No

No

No

No

## ROLE MANAGEMENT

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View Roles

Yes

Yes

No

No

No

Modify Roles

Yes

No

No

No

No

View Permissions

Yes

Yes

No

No

No

## CUSTOMER MANAGEMENT

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View Customers

Yes

Yes

Yes

Yes

No

Create Customer

Yes

Yes

Yes

No

No

Update Customer

Yes

Yes

Yes

No

No

Archive Customer

Yes

Yes

No

No

No

View Customer Ledger

Yes

Yes

Yes

No

No

Modify Customer Credit Limit

Yes

Yes

No

No

No

## SUPPLIER MANAGEMENT

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View Suppliers

Yes

Yes

No

No

No

Create Supplier

Yes

Yes

No

No

No

Update Supplier

Yes

Yes

No

No

No

Archive Supplier

Yes

Yes

No

No

No

View Supplier Ledger

Yes

Yes

No

No

No

## PRODUCT MANAGEMENT

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View Products

Yes

Yes

Yes

Yes

Yes

Create Product

Yes

Yes

No

No

No

Update Product

Yes

Yes

No

No

No

Archive Product

Yes

Yes

No

No

No

Modify Pricing

Yes

Yes

No

No

No

## INVENTORY MANAGEMENT

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View Inventory

Yes

Yes

Yes

Yes

Yes

Add Stock

Yes

Yes

No

No

No

Adjust Stock

Yes

Yes

No

No

No

Transfer Stock

Yes

Yes

No

No

No

View Inventory Movements

Yes

Yes

No

No

No

Inventory Valuation

Yes

Yes

No

No

No

## BILLING PERMISSIONS

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

Create Invoice

Yes

Yes

Yes

No

No

Edit Draft Invoice

Yes

Yes

Yes

No

No

Cancel Invoice

Yes

Yes

No

No

No

Delete Invoice

No

No

No

No

No

Print Invoice

Yes

Yes

Yes

No

No

Reprint Invoice

Yes

Yes

Yes

No

No

## PAYMENT PERMISSIONS

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

Record Payment

Yes

Yes

Yes

No

No

Reverse Payment

Yes

Yes

No

No

No

View Payments

Yes

Yes

Yes

No

No

## EXPENSE MANAGEMENT

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View Expenses

Yes

Yes

No

No

No

Create Expense

Yes

Yes

No

No

No

Modify Expense

Yes

Yes

No

No

No

Delete Expense

Yes

No

No

No

No

## REPORT PERMISSIONS

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View Reports

Yes

Yes

Limited

No

No

Export Reports

Yes

Yes

Limited

No

No

Print Reports

Yes

Yes

Limited

No

No

## ANALYTICS PERMISSIONS

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View Dashboard

Yes

Yes

Yes

Limited

Limited

View Revenue Analytics

Yes

Yes

Limited

No

No

View Expense Analytics

Yes

Yes

No

No

No

View Profit Analytics

Yes

Yes

No

No

No

View Inventory Analytics

Yes

Yes

Limited

No

No

## BACKUP & RESTORE

Critical Permissions.

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

Create Backup

Yes

Yes

No

No

No

View Backups

Yes

Yes

No

No

No

Restore Backup

Yes

No

No

No

No

Delete Backup

Yes

No

No

No

No

## SETTINGS PERMISSIONS

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View Settings

Yes

Yes

No

No

No

Modify Settings

Yes

No

No

No

No

Change Tax Settings

Yes

No

No

No

No

Change Currency Settings

Yes

No

No

No

No

## AUDIT LOG PERMISSIONS

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View Audit Logs

Yes

Limited

No

No

No

Export Audit Logs

Yes

No

No

No

No

## EXPORT PERMISSIONS

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

Export PDF

Yes

Yes

Limited

No

No

Export Excel

Yes

Yes

Limited

No

No

Export CSV

Yes

Yes

No

No

No

## RESTAURANT PERMISSIONS

### Action

### Admin

### Manager

### Cashier

### Staff

### Kitchen

View KOT

Yes

Yes

Yes

No

Yes

Update KOT Status

Yes

Yes

No

No

Yes

Manage Tables

Yes

Yes

No

No

No

Manage Recipes

Yes

Yes

No

No

No

## HARDWARE / DISTRIBUTOR PERMISSIONS

### Action

### Admin

### Manager

### Cashier

### Staff

View Outstanding

Yes

Yes

Limited

No

Modify Credit Limits

Yes

Yes

No

No

View Purchase Orders

Yes

Yes

No

No

Approve Purchase Orders

Yes

Yes

No

No

## FUTURE ROLES

Reserved For:

Accountant

Auditor

Warehouse Staff

Branch Manager

Regional Manager

Support Agent

Manufacturing Supervisor

## AUDIT REQUIREMENTS

The following actions must always create audit logs:

Invoice Cancellation

Inventory Adjustments

Payment Reversals

Backup Restore

User Changes

Role Changes

Settings Changes

Tax Changes

Currency Changes

## PERMISSION ENFORCEMENT RULES

Permissions must be enforced at:

UI Layer

Service Layer

Database Layer

Never rely solely on hidden buttons.

## DEFAULT SECURITY RULE

If permission is undefined:

DENY ACCESS

## MULTI-BUSINESS FUTURE READINESS

Future versions may support:

Branch-Level Permissions

Department Permissions

Location Permissions

Regional Permissions

## SUCCESS CRITERIA

Every user should see:

Only what they need.

Only what they are allowed to access.

Only what is relevant to their role.

## FINAL PRINCIPLE

Good permissions create security.

Great permissions create trust.

Sarang should always prioritize:

Data Protection

Operational Control

Business Integrity

User Accountability

## PERMISSION ENFORCEMENT ARCHITECTURE

All permission checks flow through a single entry point:

```typescript
// src/main/security/permission-guard.ts
function requirePermission(event: IpcMainInvokeEvent, permissionKey: string): void {
  const user = getSessionUser(event.sender);
  if (!user) throw new PermissionError('AUTH-003', 'Not authenticated');
  if (!user.permissions.includes(permissionKey)) {
    throw new PermissionError('PERM-001', 'You do not have permission to perform this action');
  }
}
```

Every IPC handler MUST call `requirePermission()` before any business logic.

Enforcement layers (all must be implemented):
1. **UI Layer**: Hide/disable actions the user cannot take
2. **IPC Layer**: `requirePermission()` before every handler body
3. **Service Layer**: Re-validate for sensitive operations inside transactions
4. **Database Layer**: Schema constraints as final backstop

## PERMISSION CONFLICT RESOLUTION

**Role changes take effect on next login** — active sessions retain old permissions until logout.

**Undefined permissions = DENY** — new features must explicitly be granted to roles, never auto-granted.

**Privilege escalation rule** — a user cannot grant permissions they do not themselves have.

**Last Admin protection** — the system must block deactivation or role downgrade of the last Admin (RULE U005).

## QUICK REFERENCE SUMMARY

| Module | Admin | Manager | Cashier | Staff | Kitchen |
|--------|-------|---------|---------|-------|---------|
| User Management | Full | No | No | No | No |
| Role Management | Full | No | No | No | No |
| Products | Full | Full | View | View | View |
| Inventory | Full | Full | View | View | View |
| Billing | Full | Full | Create/View | No | No |
| Payments | Full | Full | Record | No | No |
| Expenses | Full | Full | No | No | No |
| Reports | Full | Full | Limited | No | No |
| Analytics | Full | Full | Limited | Limited | Limited |
| Backup (Create) | Yes | Yes | No | No | No |
| Backup (Restore) | Yes | No | No | No | No |
| Settings (View) | Yes | Yes | No | No | No |
| Settings (Modify) | Yes | No | No | No | No |
| KOT (Restaurant) | Full | Full | View | No | View/Update |
| Audit Logs | Full | Limited | No | No | No |

Powered by Aszurex.

Trust Beyond Limits.
