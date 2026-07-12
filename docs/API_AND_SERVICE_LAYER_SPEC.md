# API_AND_SERVICE_LAYER_SPEC.md

## SARANG BUSINESS OS LITE

### Powered by Aszurex

### Trust Beyond Limits

Version: 1.0

Document Type: Service Layer & Internal API Specification

## PURPOSE

This document defines:

- Service Layer Architecture
- Internal APIs
- Service Responsibilities
- Validation Standards
- Error Handling Standards
- Transaction Rules
- Business Logic Boundaries

The objective is to ensure:

Maintainability

Consistency

Scalability

Reliability

Low Support Burden

## CORE PHILOSOPHY

UI should display data.

Database should store data.

Services should enforce business rules.

## ARCHITECTURE FLOW

React UI

↓

IPC Layer

↓

Application Services

↓

Repository Layer

↓

SQLite Database

## RULES

Frontend must NEVER:

Query database directly

Modify database directly

Calculate business rules

Perform permission checks

Handle inventory calculations

Handle tax calculations

All business logic belongs inside services.

## SERVICE DESIGN PRINCIPLES

Services must be:

Single Purpose

Reusable

Testable

Typed

Documented

Independent

## STANDARD SERVICE STRUCTURE

billing/

├── billing.service.ts

├── billing.repository.ts

├── billing.validation.ts

├── billing.types.ts

├── billing.tests.ts

## SERVICE RESPONSE FORMAT

All services return:

{

 success: boolean,

 data?: T,

 error?: ErrorObject

}

## ERROR FORMAT

{

 code: string,

 message: string,

 details?: object

}

## AUTHENTICATION SERVICE

File:

AuthService

Responsibilities:

Login

Logout

Password Validation

Session Management

Role Retrieval

Permission Retrieval

Functions:

login()

logout()

changePassword()

validateSession()

getCurrentUser()

## AUTHORIZATION SERVICE

File:

AuthorizationService

Responsibilities:

Permission Checks

Role Checks

Access Control

Functions:

canCreateInvoice()

canDeleteInvoice()

canManageUsers()

canRestoreBackup()

hasPermission()

## USER SERVICE

Responsibilities:

User Management

User Creation

User Updates

Role Assignment

Activation

Deactivation

Functions:

createUser()

updateUser()

deactivateUser()

assignRole()

## PRODUCT SERVICE

Responsibilities:

Product Management

Pricing

Categories

Barcode Handling

Variants

Functions:

createProduct()

updateProduct()

deleteProduct()

getProduct()

searchProducts()

## INVENTORY SERVICE

Critical Service.

Responsibilities:

Stock Management

Stock Validation

Inventory Movements

Adjustments

Availability Checks

Functions:

addStock()

reduceStock()

adjustStock()

transferStock()

getInventory()

getMovements()

## INVENTORY RULES

All inventory updates must:

Create movement record

Update stock

Validate quantities

Run inside transaction

Inventory calculations must never occur in UI.

## CUSTOMER SERVICE

Responsibilities:

Customer Management

Outstanding Tracking

Credit Tracking

Customer Search

Functions:

createCustomer()

updateCustomer()

getCustomer()

searchCustomers()

calculateOutstanding()

## CUSTOMER LEDGER SERVICE

Responsibilities:

Credits

Debits

Balance Calculation

Outstanding Calculation

Functions:

addLedgerEntry()

getLedger()

calculateBalance()

## SUPPLIER SERVICE

Responsibilities:

Supplier Management

Outstanding Tracking

Purchase History

Functions:

createSupplier()

updateSupplier()

searchSuppliers()

getSupplier()

## SUPPLIER LEDGER SERVICE

Responsibilities:

Supplier Credits

Supplier Debits

Supplier Balance

Functions:

addEntry()

calculateBalance()

getLedger()

## BILLING SERVICE

Mission Critical.

Responsibilities:

Invoice Creation

Invoice Validation

Tax Calculation

Discount Calculation

Inventory Deduction

Payment Tracking

Functions:

createInvoice()

updateInvoice()

cancelInvoice()

getInvoice()

printInvoice()

## BILLING WORKFLOW

Create Invoice

↓

Validate Products

↓

Validate Inventory

↓

Calculate Taxes

↓

Calculate Totals

↓

Create Invoice

↓

Deduct Inventory

↓

Update Reports

↓

Create Audit Log

Must run as transaction.

## TAX SERVICE

Responsibilities:

GST

VAT

Sales Tax

Custom Tax

No Tax

Functions:

calculateTax()

validateTax()

getTaxRules()

Tax rules must never be hardcoded.

## PAYMENT SERVICE

Responsibilities:

Payment Recording

Outstanding Updates

Ledger Updates

Functions:

recordPayment()

reversePayment()

getPayments()

Important:

Not payment processing.

Not payment verification.

Only payment recording.

## UPI QR SERVICE

Responsibilities:

Generate UPI QR

Generate Payment URI

Invoice QR

Functions:

generateQR()

generateUPIUri()

Must never:

Verify Payments

Process Payments

Hold Funds

## PURCHASE ORDER SERVICE

Responsibilities:

Purchase Orders

Inventory Updates

Supplier Updates

Functions:

createPO()

approvePO()

receivePO()

cancelPO()

## EXPENSE SERVICE

Responsibilities:

Expense Recording

Category Tracking

Reporting Integration

Functions:

createExpense()

updateExpense()

deleteExpense()

## REPORT SERVICE

Responsibilities:

Generate Reports

Export Reports

Filter Reports

Functions:

generateSalesReport()

generateInventoryReport()

generateTaxReport()

generateCustomerReport()

## ANALYTICS SERVICE

Responsibilities:

Dashboard KPIs

Trend Calculations

Business Metrics

Functions:

getRevenueTrend()

getExpenseTrend()

getInventoryValue()

getTopProducts()

## BACKUP SERVICE

Critical Service.

Responsibilities:

Backup

Restore

Validation

Integrity Checks

Functions:

createBackup()

restoreBackup()

validateBackup()

listBackups()

## AUDIT SERVICE

Responsibilities:

Activity Tracking

Change Tracking

Security Auditing

Functions:

logAction()

getAuditLogs()

## SETTINGS SERVICE

Responsibilities:

System Configuration

Currency

Tax

Templates

Preferences

Functions:

updateSettings()

getSettings()

## NOTIFICATION SERVICE

Responsibilities:

In-App Notifications

Reminders

Warnings

Alerts

Functions:

createNotification()

markRead()

getNotifications()

## EXPORT SERVICE

Responsibilities:

PDF

Excel

CSV

Functions:

exportPDF()

exportExcel()

exportCSV()

## PRINT SERVICE

Responsibilities:

Receipt Printing

Invoice Printing

Report Printing

Functions:

printReceipt()

printInvoice()

printReport()

## INDUSTRY TEMPLATE SERVICE

Responsibilities:

Template Configuration

Feature Flags

Dashboard Layouts

Module Activation

Functions:

loadTemplate()

activateModule()

deactivateModule()

## BUSINESS PROFILE SERVICE

Responsibilities:

Business Settings

Tax Information

Branding

Currency

Country

Functions:

getProfile()

updateProfile()

## TRANSACTION RULES

Must Use Transactions:

Invoice Creation

Invoice Cancellation

Stock Updates

Purchase Orders

Backup Restore

Migration Operations

Payment Recording

## VALIDATION RULES

Every service must validate:

Inputs

Business Rules

Permissions

Data Integrity

Never trust UI validation.

## ERROR HANDLING RULES

Services must:

Fail Gracefully

Provide Meaningful Errors

Avoid Technical Jargon

Log Failures

Protect Data

## SERVICE TESTING REQUIREMENTS

Every service must have:

Unit Tests

Integration Tests

Validation Tests

Permission Tests

Error Tests

## DEPENDENCY RULES

Services may depend on:

Repositories

Utilities

Validation Layers

Services must NOT depend on:

UI Components

Screens

React Components

## FUTURE SERVICES

Reserved:

CRMService

HelpdeskService

ManufacturingService

CrebitXService

WorkflowService

DocumentService

AIService (Future)

## FINAL SERVICE OBJECTIVE

The service layer should become:

The single source of business truth.

Every invoice.

Every inventory update.

Every payment.

Every report.

Every backup.

should pass through services.

One Rule Engine.

One Source Of Truth.

One Business OS.

## TYPESCRIPT SERVICE INTERFACES

### Standard ServiceResult Pattern

```typescript
interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
}

interface ServiceError {
  code: string;       // ERROR_CATALOG.md code (e.g., 'INV-001')
  message: string;    // User-friendly message
  details?: unknown;  // Technical context — logged, never shown to user
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

### AuthService Signatures

```typescript
AuthService.login(input: { username: string; password: string }): Promise<ServiceResult<AuthUser>>
AuthService.logout(): Promise<ServiceResult<void>>
AuthService.changePassword(userId: number, current: string, next: string): Promise<ServiceResult<void>>
AuthService.validateSession(): Promise<ServiceResult<AuthUser>>
AuthService.getCurrentUser(): Promise<ServiceResult<AuthUser>>

interface AuthUser {
  id: number; full_name: string; username: string;
  role_id: number; role_name: string; permissions: string[];
}
```

### BillingService Signatures

```typescript
BillingService.createInvoice(input: InvoiceCreateInput): Promise<ServiceResult<Invoice>>
BillingService.updateInvoice(id: number, input: Partial<InvoiceCreateInput>): Promise<ServiceResult<Invoice>>
BillingService.cancelInvoice(id: number, reason: string): Promise<ServiceResult<void>>
BillingService.getInvoice(id: number): Promise<ServiceResult<Invoice>>
BillingService.searchInvoices(filters: InvoiceFilters, page?: number): Promise<ServiceResult<PaginatedResult<Invoice>>>

interface Invoice {
  id: number; invoice_number: string;
  status: 'DRAFT' | 'FINAL' | 'CANCELLED';
  payment_status: 'UNPAID' | 'PARTIAL' | 'PAID';
  subtotal: number; discount_amount: number;
  tax_amount: number; total_amount: number;
  paid_amount: number; balance_amount: number;
  items: InvoiceItem[];
}
```

### InventoryService Signatures

```typescript
type MovementType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGE' | 'OPENING_STOCK' | 'TRANSFER';

InventoryService.addStock(input: StockMovementInput): Promise<ServiceResult<InventoryRecord>>
InventoryService.reduceStock(input: StockMovementInput): Promise<ServiceResult<InventoryRecord>>
InventoryService.adjustStock(input: StockMovementInput): Promise<ServiceResult<InventoryRecord>>
InventoryService.getInventory(productId: number): Promise<ServiceResult<InventoryRecord>>
InventoryService.checkAvailability(productId: number, qty: number): Promise<ServiceResult<{ available: boolean; currentStock: number }>>
InventoryService.getMovements(productId: number, filters?: MovementFilters): Promise<ServiceResult<PaginatedResult<InventoryMovement>>>
```

### PaymentService Signatures

```typescript
// PM005: recordPayment RECORDS only. Never verifies, confirms, or processes payments.
type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'BANK_TRANSFER' | 'CREDIT' | 'MIXED';

PaymentService.recordPayment(input: PaymentInput): Promise<ServiceResult<PaymentRecord>>
PaymentService.reversePayment(id: number, reason: string): Promise<ServiceResult<void>>
PaymentService.getPayments(invoiceId: number): Promise<ServiceResult<PaymentRecord[]>>

interface PaymentRecord {
  id: number; invoice_id: number; amount: number;
  payment_method: PaymentMethod; payment_date: string;
  reference_number?: string; recorded_by: number;
}
```

### BackupService Signatures

```typescript
BackupService.createBackup(opts: { destination_path: string; backup_name?: string }): Promise<ServiceResult<BackupMetadata>>
BackupService.restoreBackup(backupPath: string): Promise<ServiceResult<void>>
BackupService.validateBackup(backupPath: string): Promise<ServiceResult<BackupValidation>>
BackupService.listBackups(): Promise<ServiceResult<BackupMetadata[]>>

interface BackupMetadata {
  id: number; backup_name: string; backup_path: string;
  backup_size: number; backup_date: string;
  backup_version: string; sha256_checksum: string;
}

interface BackupValidation {
  valid: boolean; version: string;
  checksum_match: boolean; size_bytes: number;
}
```

### Standard Error Contract Mapping

```typescript
// Map internal errors to ERROR_CATALOG.md codes at service boundary:
// P2002 (Prisma unique)    → PROD-001 / USER-001 / INVOC-004 (context-specific)
// P2003 (Prisma FK)        → SYS-001
// Insufficient stock check → INV-001
// Permission failure       → PERM-001
// Session missing          → AUTH-003
// Unexpected               → SYS-001 (always log internal details)
```

Powered by Aszurex.

Trust Beyond Limits.
