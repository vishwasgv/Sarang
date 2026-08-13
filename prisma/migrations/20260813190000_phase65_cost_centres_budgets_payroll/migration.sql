-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN "statutoryEsiPercent" REAL;
ALTER TABLE "BusinessProfile" ADD COLUMN "statutoryEsiWageCeiling" REAL;
ALTER TABLE "BusinessProfile" ADD COLUMN "statutoryPfPercent" REAL;
ALTER TABLE "BusinessProfile" ADD COLUMN "statutoryProfessionalTax" REAL;

-- CreateTable
CREATE TABLE "CostCentre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "costCentreId" TEXT,
    "accountId" TEXT,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Budget_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Budget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Budget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "billDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "balanceAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "costCentreId" TEXT,
    CONSTRAINT "Bill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bill_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bill_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bill" ("balanceAmount", "billDate", "billNumber", "createdAt", "createdById", "discountAmount", "dueDate", "id", "isReverseCharge", "notes", "paidAmount", "purchaseOrderId", "status", "subtotal", "supplierId", "taxAmount", "totalAmount", "updatedAt") SELECT "balanceAmount", "billDate", "billNumber", "createdAt", "createdById", "discountAmount", "dueDate", "id", "isReverseCharge", "notes", "paidAmount", "purchaseOrderId", "status", "subtotal", "supplierId", "taxAmount", "totalAmount", "updatedAt" FROM "Bill";
DROP TABLE "Bill";
ALTER TABLE "new_Bill" RENAME TO "Bill";
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");
CREATE INDEX "Bill_supplierId_idx" ON "Bill"("supplierId");
CREATE INDEX "Bill_purchaseOrderId_idx" ON "Bill"("purchaseOrderId");
CREATE INDEX "Bill_status_idx" ON "Bill"("status");
CREATE INDEX "Bill_billDate_idx" ON "Bill"("billDate");
CREATE INDEX "Bill_costCentreId_idx" ON "Bill"("costCentreId");
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeNumber" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "employeeType" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "joinDate" DATETIME NOT NULL,
    "exitDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "salaryType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "basicSalary" REAL NOT NULL DEFAULT 0,
    "allowances" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "commissionRate" REAL,
    "commissionType" TEXT DEFAULT 'PERCENT',
    "hourlyBillingRate" REAL,
    "specialization" TEXT,
    "providerCalendarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "providerColor" TEXT,
    "maxAppointmentsPerDay" INTEGER,
    "primaryLocationId" TEXT,
    "costCentreId" TEXT,
    CONSTRAINT "Employee_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("allowances", "basicSalary", "commissionRate", "commissionType", "createdAt", "department", "designation", "email", "employeeNumber", "employeeType", "exitDate", "fullName", "hourlyBillingRate", "id", "isActive", "joinDate", "maxAppointmentsPerDay", "notes", "phone", "primaryLocationId", "providerCalendarEnabled", "providerColor", "salaryType", "specialization", "updatedAt") SELECT "allowances", "basicSalary", "commissionRate", "commissionType", "createdAt", "department", "designation", "email", "employeeNumber", "employeeType", "exitDate", "fullName", "hourlyBillingRate", "id", "isActive", "joinDate", "maxAppointmentsPerDay", "notes", "phone", "primaryLocationId", "providerCalendarEnabled", "providerColor", "salaryType", "specialization", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");
CREATE INDEX "Employee_department_idx" ON "Employee"("department");
CREATE INDEX "Employee_costCentreId_idx" ON "Employee"("costCentreId");
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "expenseName" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "expenseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "supplierId" TEXT,
    "mileageKm" REAL,
    "mileageRatePerKm" REAL,
    "billableCustomerId" TEXT,
    "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "costCentreId" TEXT,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_billableCustomerId_fkey" FOREIGN KEY ("billableCustomerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "billableCustomerId", "categoryId", "createdAt", "createdById", "expenseDate", "expenseName", "id", "isReverseCharge", "mileageKm", "mileageRatePerKm", "paymentMethod", "remarks", "supplierId", "updatedAt") SELECT "amount", "billableCustomerId", "categoryId", "createdAt", "createdById", "expenseDate", "expenseName", "id", "isReverseCharge", "mileageKm", "mileageRatePerKm", "paymentMethod", "remarks", "supplierId", "updatedAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
CREATE INDEX "Expense_supplierId_idx" ON "Expense"("supplierId");
CREATE INDEX "Expense_billableCustomerId_idx" ON "Expense"("billableCustomerId");
CREATE INDEX "Expense_costCentreId_idx" ON "Expense"("costCentreId");
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL DEFAULT 'RETAIL',
    "customerId" TEXT,
    "invoiceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "roundingAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "balanceAmount" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "gstType" TEXT NOT NULL DEFAULT 'CGST_SGST',
    "buyerState" TEXT,
    "notes" TEXT,
    "quotationId" TEXT,
    "originalInvoiceId" TEXT,
    "tableId" TEXT,
    "splitFromInvoiceId" TEXT,
    "ewayBillNumber" TEXT,
    "salesOrderId" TEXT,
    "invoiceTemplateId" TEXT,
    "costCentreId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_splitFromInvoiceId_fkey" FOREIGN KEY ("splitFromInvoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_invoiceTemplateId_fkey" FOREIGN KEY ("invoiceTemplateId") REFERENCES "InvoiceTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("balanceAmount", "buyerState", "createdAt", "createdById", "customerId", "discountAmount", "dueDate", "ewayBillNumber", "gstType", "id", "invoiceDate", "invoiceNumber", "invoiceTemplateId", "invoiceType", "notes", "originalInvoiceId", "paidAmount", "paymentStatus", "quotationId", "roundingAmount", "salesOrderId", "splitFromInvoiceId", "status", "subtotal", "tableId", "taxAmount", "totalAmount", "updatedAt") SELECT "balanceAmount", "buyerState", "createdAt", "createdById", "customerId", "discountAmount", "dueDate", "ewayBillNumber", "gstType", "id", "invoiceDate", "invoiceNumber", "invoiceTemplateId", "invoiceType", "notes", "originalInvoiceId", "paidAmount", "paymentStatus", "quotationId", "roundingAmount", "salesOrderId", "splitFromInvoiceId", "status", "subtotal", "tableId", "taxAmount", "totalAmount", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_quotationId_key" ON "Invoice"("quotationId");
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX "Invoice_salesOrderId_idx" ON "Invoice"("salesOrderId");
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_status_invoiceDate_idx" ON "Invoice"("status", "invoiceDate");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");
CREATE INDEX "Invoice_createdById_idx" ON "Invoice"("createdById");
CREATE INDEX "Invoice_originalInvoiceId_idx" ON "Invoice"("originalInvoiceId");
CREATE INDEX "Invoice_tableId_idx" ON "Invoice"("tableId");
CREATE INDEX "Invoice_splitFromInvoiceId_idx" ON "Invoice"("splitFromInvoiceId");
CREATE INDEX "Invoice_costCentreId_idx" ON "Invoice"("costCentreId");
CREATE TABLE "new_JournalEntryLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "costCentreId" TEXT,
    "debitAmount" REAL NOT NULL DEFAULT 0,
    "creditAmount" REAL NOT NULL DEFAULT 0,
    "remarks" TEXT,
    CONSTRAINT "JournalEntryLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalEntryLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "JournalEntryLine_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JournalEntryLine_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JournalEntryLine" ("accountId", "bankAccountId", "creditAmount", "debitAmount", "id", "journalEntryId", "remarks") SELECT "accountId", "bankAccountId", "creditAmount", "debitAmount", "id", "journalEntryId", "remarks" FROM "JournalEntryLine";
DROP TABLE "JournalEntryLine";
ALTER TABLE "new_JournalEntryLine" RENAME TO "JournalEntryLine";
CREATE INDEX "JournalEntryLine_journalEntryId_idx" ON "JournalEntryLine"("journalEntryId");
CREATE INDEX "JournalEntryLine_accountId_idx" ON "JournalEntryLine"("accountId");
CREATE INDEX "JournalEntryLine_bankAccountId_idx" ON "JournalEntryLine"("bankAccountId");
CREATE INDEX "JournalEntryLine_costCentreId_idx" ON "JournalEntryLine"("costCentreId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CostCentre_isActive_idx" ON "CostCentre"("isActive");

-- CreateIndex
CREATE INDEX "Budget_costCentreId_idx" ON "Budget"("costCentreId");

-- CreateIndex
CREATE INDEX "Budget_accountId_idx" ON "Budget"("accountId");

-- CreateIndex
CREATE INDEX "Budget_periodYear_periodMonth_idx" ON "Budget"("periodYear", "periodMonth");

-- NOTE: prisma migrate diff also emitted 5 "RedefineIndex" blocks here
-- (DROP INDEX "sqlite_autoindex_*" / CREATE UNIQUE INDEX for
-- DeliveryTracker/LearnerProfile/StudentProfile/TokenQueue/VisitNote) —
-- pre-existing schema drift unrelated to Phase 65, and SQLite refuses to
-- DROP an autoindex backing a UNIQUE constraint directly. Deliberately
-- stripped from this migration, matching this project's own established
-- "harmless pre-existing drift, don't let it block a real migration"
-- precedent (see feedback_gitbash_mangles_prisma_paths / prior phases'
-- own migration notes) — those 5 tables' actual constraints are already
-- correctly enforced by the existing autoindexes; only the index's
-- internal name would differ from what a fresh `prisma migrate diff`
-- expects, which is cosmetic, not a real schema gap.

