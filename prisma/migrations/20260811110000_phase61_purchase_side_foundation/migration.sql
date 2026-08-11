-- Phase 61 — Purchase Side & Core Ledger Foundation. See
-- PHASE_61_ROADMAP_MASTER_PROMPT.md, Section 3, for the full spec.
--
-- Also carries a real, separate fix found while applying this: AuditLog.userId's
-- foreign key was RESTRICT in schema.prisma (a deliberate 2026-07-30 fix
-- protecting the tamper-evident hash chain from a hard-deleted user silently
-- corrupting historical rows — see the model's own comment) but the live dev
-- database had never actually received that change, despite the migration
-- file for it existing and being correct. Folded into this migration rather
-- than a separate one since both were applied together and both needed the
-- same RedefineTables treatment SQLite requires for an FK constraint change.

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "ewayBillNumber" TEXT;

-- CreateTable
CREATE TABLE "Bill" (
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
    CONSTRAINT "Bill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bill_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceDescription" TEXT,
    "serviceCategoryId" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitCost" REAL NOT NULL,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BillItem_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "supplierId" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "referenceNumber" TEXT,
    "paymentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversalReason" TEXT,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductCostHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "unitCost" REAL NOT NULL,
    "quantity" REAL NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductCostHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- NOTE: this migration deliberately does NOT include a CREATE TABLE "Lead" —
-- Lead already exists correctly from its own original migration for anyone
-- replaying full history (verified by testing this exact migration against a
-- genuinely fresh database — an earlier draft of this file DID include one,
-- which broke a clean install with "table Lead already exists"). Lead was
-- only ever missing on the one specific dev database this migration was
-- authored against, because it had drifted (a separate, pre-existing FK bug
-- unrelated to Phase 61) and was repaired there directly via a one-off
-- `prisma db execute`, not as part of this tracked migration.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT,
    "prevHash" TEXT,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "createdAt", "entityId", "entityType", "hash", "id", "newValue", "oldValue", "prevHash", "userId") SELECT "action", "createdAt", "entityId", "entityType", "hash", "id", "newValue", "oldValue", "prevHash", "userId" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerCode" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "taxNumber" TEXT,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "taxExemptReason" TEXT,
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "outstandingBalance" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "customerClass" TEXT,
    "lastAgmDate" DATETIME,
    "customerKind" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "companyRegistrationNumber" TEXT,
    "contactPersonName" TEXT,
    "idProofType" TEXT,
    "idProofNumber" TEXT
);
INSERT INTO "new_Customer" ("address", "city", "country", "createdAt", "creditLimit", "customerClass", "customerCode", "customerName", "email", "id", "isActive", "lastAgmDate", "notes", "outstandingBalance", "phone", "state", "taxExempt", "taxExemptReason", "taxNumber", "updatedAt") SELECT "address", "city", "country", "createdAt", "creditLimit", "customerClass", "customerCode", "customerName", "email", "id", "isActive", "lastAgmDate", "notes", "outstandingBalance", "phone", "state", "taxExempt", "taxExemptReason", "taxNumber", "updatedAt" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode");
CREATE INDEX "Customer_customerName_idx" ON "Customer"("customerName");
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");
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
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_billableCustomerId_fkey" FOREIGN KEY ("billableCustomerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "categoryId", "createdAt", "createdById", "expenseDate", "expenseName", "id", "paymentMethod", "remarks", "updatedAt") SELECT "amount", "categoryId", "createdAt", "createdById", "expenseDate", "expenseName", "id", "paymentMethod", "remarks", "updatedAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
CREATE INDEX "Expense_supplierId_idx" ON "Expense"("supplierId");
CREATE INDEX "Expense_billableCustomerId_idx" ON "Expense"("billableCustomerId");
CREATE TABLE "new_PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceDescription" TEXT,
    "serviceCategoryId" TEXT,
    "quantity" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "itcAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedQty" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderItem_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrderItem" ("createdAt", "id", "itcAmount", "productId", "purchaseOrderId", "quantity", "receivedQty", "taxAmount", "taxRate", "total", "unitCost") SELECT "createdAt", "id", "itcAmount", "productId", "purchaseOrderId", "quantity", "receivedQty", "taxAmount", "taxRate", "total", "unitCost" FROM "PurchaseOrderItem";
DROP TABLE "PurchaseOrderItem";
ALTER TABLE "new_PurchaseOrderItem" RENAME TO "PurchaseOrderItem";
CREATE INDEX "PurchaseOrderItem_serviceCategoryId_idx" ON "PurchaseOrderItem"("serviceCategoryId");
CREATE TABLE "new_Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierCode" TEXT,
    "supplierName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "taxNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "bankAccountNumber" TEXT,
    "bankIfscCode" TEXT,
    "bankName" TEXT,
    "panNumber" TEXT,
    "openingBalance" REAL NOT NULL DEFAULT 0
);
INSERT INTO "new_Supplier" ("address", "city", "country", "createdAt", "email", "id", "isActive", "notes", "phone", "state", "supplierCode", "supplierName", "taxNumber", "updatedAt") SELECT "address", "city", "country", "createdAt", "email", "id", "isActive", "notes", "phone", "state", "supplierCode", "supplierName", "taxNumber", "updatedAt" FROM "Supplier";
DROP TABLE "Supplier";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
CREATE UNIQUE INDEX "Supplier_supplierCode_key" ON "Supplier"("supplierCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");

-- CreateIndex
CREATE INDEX "Bill_supplierId_idx" ON "Bill"("supplierId");

-- CreateIndex
CREATE INDEX "Bill_purchaseOrderId_idx" ON "Bill"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Bill_billDate_idx" ON "Bill"("billDate");

-- CreateIndex
CREATE INDEX "BillItem_billId_idx" ON "BillItem"("billId");

-- CreateIndex
CREATE INDEX "BillItem_serviceCategoryId_idx" ON "BillItem"("serviceCategoryId");

-- CreateIndex
CREATE INDEX "SupplierPayment_billId_idx" ON "SupplierPayment"("billId");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierPayment_paymentDate_idx" ON "SupplierPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "SupplierPayment_isReversed_idx" ON "SupplierPayment"("isReversed");

-- CreateIndex
CREATE INDEX "ProductCostHistory_productId_idx" ON "ProductCostHistory"("productId");

-- CreateIndex
CREATE INDEX "ProductCostHistory_recordedAt_idx" ON "ProductCostHistory"("recordedAt");

-- Lead's own indexes (status/assignedToId/convertedClientId) are likewise
-- NOT recreated here for the same reason as the note above — they already
-- exist from Lead's original migration on any normal install.
