-- Phase 62 — Banking, Ledger & Compliance Backbone foundation schema.
-- Generated via `prisma migrate diff` (schema vs. live DB directly) rather
-- than `prisma migrate dev`, which refused to proceed and demanded a full
-- destructive reset over an unrelated pre-existing migration-history/live-DB
-- mismatch on the Lead table (confirmed by direct inspection: Lead's live
-- columns/indexes already match schema.prisma exactly — the mismatch is in
-- historical migration-file replay bookkeeping, not real data).
--
-- The five "RedefineIndex" statements at the end of this file
-- (DeliveryTracker/LearnerProfile/StudentProfile/TokenQueue/VisitNote) are a
-- separate, unrelated, pre-existing drift the diff tool surfaced alongside
-- the real Phase 62 changes — a harmless index-naming difference (an
-- inline-UNIQUE-generated sqlite_autoindex vs. Prisma's own named
-- CREATE UNIQUE INDEX convention), not a Phase 62 feature. Bundled here
-- because they were part of the same diff output, not applied as a separate
-- silent fix.
-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'BANK',
    "bankName" TEXT,
    "accountNumberMasked" TEXT,
    "ifscCode" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "openingBalance" REAL NOT NULL DEFAULT 0,
    "currentBalance" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankAccountId" TEXT NOT NULL,
    "transactionDate" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "debitAmount" REAL NOT NULL DEFAULT 0,
    "creditAmount" REAL NOT NULL DEFAULT 0,
    "matchedType" TEXT,
    "matchedId" TEXT,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" DATETIME,
    "importBatchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankStatementLine_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChartOfAccounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "parentId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChartOfAccounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChartOfAccounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryNumber" TEXT NOT NULL,
    "entryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "narration" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversalReason" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntryLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "debitAmount" REAL NOT NULL DEFAULT 0,
    "creditAmount" REAL NOT NULL DEFAULT 0,
    "remarks" TEXT,
    CONSTRAINT "JournalEntryLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalEntryLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "JournalEntryLine_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostDatedCheque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankAccountId" TEXT NOT NULL,
    "chequeNumber" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "partyType" TEXT,
    "partyId" TEXT,
    "dueDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostDatedCheque_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetCode" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "category" TEXT,
    "purchaseDate" DATETIME NOT NULL,
    "purchaseCost" REAL NOT NULL,
    "usefulLifeMonths" INTEGER NOT NULL,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
    "salvageValue" REAL NOT NULL DEFAULT 0,
    "accumulatedDepreciation" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "disposalDate" DATETIME,
    "disposalAmount" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FixedAssetDepreciation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fixedAssetId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "journalEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FixedAssetDepreciation_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    CONSTRAINT "Bill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bill_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bill" ("balanceAmount", "billDate", "billNumber", "createdAt", "createdById", "discountAmount", "dueDate", "id", "notes", "paidAmount", "purchaseOrderId", "status", "subtotal", "supplierId", "taxAmount", "totalAmount", "updatedAt") SELECT "balanceAmount", "billDate", "billNumber", "createdAt", "createdById", "discountAmount", "dueDate", "id", "notes", "paidAmount", "purchaseOrderId", "status", "subtotal", "supplierId", "taxAmount", "totalAmount", "updatedAt" FROM "Bill";
DROP TABLE "Bill";
ALTER TABLE "new_Bill" RENAME TO "Bill";
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");
CREATE INDEX "Bill_supplierId_idx" ON "Bill"("supplierId");
CREATE INDEX "Bill_purchaseOrderId_idx" ON "Bill"("purchaseOrderId");
CREATE INDEX "Bill_status_idx" ON "Bill"("status");
CREATE INDEX "Bill_billDate_idx" ON "Bill"("billDate");
CREATE TABLE "new_BusinessProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessName" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "businessCategory" TEXT NOT NULL DEFAULT 'PRODUCT',
    "serviceTemplateType" TEXT,
    "clinicSpecialty" TEXT,
    "languageLock" TEXT NOT NULL DEFAULT 'multi',
    "ownerName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "postalCode" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "currencySymbol" TEXT NOT NULL DEFAULT '₹',
    "taxModel" TEXT NOT NULL DEFAULT 'GST',
    "taxNumber" TEXT,
    "drugLicenseNumber" TEXT,
    "upiId" TEXT,
    "website" TEXT,
    "logoPath" TEXT,
    "showLogoOnDashboard" BOOLEAN NOT NULL DEFAULT false,
    "enableDocumentWatermark" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "lockDate" DATETIME,
    "gstScheme" TEXT NOT NULL DEFAULT 'REGULAR',
    "creditInterestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "creditInterestRatePercent" REAL NOT NULL DEFAULT 0,
    "creditInterestType" TEXT NOT NULL DEFAULT 'SIMPLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BusinessProfile" ("address", "businessCategory", "businessName", "businessType", "city", "clinicSpecialty", "country", "createdAt", "currencyCode", "currencySymbol", "drugLicenseNumber", "email", "enableDocumentWatermark", "id", "languageLock", "logoPath", "ownerName", "phone", "postalCode", "serviceTemplateType", "showLogoOnDashboard", "state", "taxModel", "taxNumber", "timezone", "updatedAt", "upiId", "website") SELECT "address", "businessCategory", "businessName", "businessType", "city", "clinicSpecialty", "country", "createdAt", "currencyCode", "currencySymbol", "drugLicenseNumber", "email", "enableDocumentWatermark", "id", "languageLock", "logoPath", "ownerName", "phone", "postalCode", "serviceTemplateType", "showLogoOnDashboard", "state", "taxModel", "taxNumber", "timezone", "updatedAt", "upiId", "website" FROM "BusinessProfile";
DROP TABLE "BusinessProfile";
ALTER TABLE "new_BusinessProfile" RENAME TO "BusinessProfile";
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
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_billableCustomerId_fkey" FOREIGN KEY ("billableCustomerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "billableCustomerId", "categoryId", "createdAt", "createdById", "expenseDate", "expenseName", "id", "mileageKm", "mileageRatePerKm", "paymentMethod", "remarks", "supplierId", "updatedAt") SELECT "amount", "billableCustomerId", "categoryId", "createdAt", "createdById", "expenseDate", "expenseName", "id", "mileageKm", "mileageRatePerKm", "paymentMethod", "remarks", "supplierId", "updatedAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
CREATE INDEX "Expense_supplierId_idx" ON "Expense"("supplierId");
CREATE INDEX "Expense_billableCustomerId_idx" ON "Expense"("billableCustomerId");
CREATE TABLE "new_PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrder" ("createdAt", "createdById", "expectedDate", "id", "notes", "orderDate", "poNumber", "status", "subtotal", "supplierId", "taxAmount", "totalAmount", "updatedAt") SELECT "createdAt", "createdById", "expectedDate", "id", "notes", "orderDate", "poNumber", "status", "subtotal", "supplierId", "taxAmount", "totalAmount", "updatedAt" FROM "PurchaseOrder";
DROP TABLE "PurchaseOrder";
ALTER TABLE "new_PurchaseOrder" RENAME TO "PurchaseOrder";
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");
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
    "openingBalance" REAL NOT NULL DEFAULT 0,
    "isMsmeRegistered" BOOLEAN NOT NULL DEFAULT false,
    "msmeCategory" TEXT
);
INSERT INTO "new_Supplier" ("address", "bankAccountNumber", "bankIfscCode", "bankName", "city", "country", "createdAt", "email", "id", "isActive", "notes", "openingBalance", "panNumber", "phone", "state", "supplierCode", "supplierName", "taxNumber", "updatedAt") SELECT "address", "bankAccountNumber", "bankIfscCode", "bankName", "city", "country", "createdAt", "email", "id", "isActive", "notes", "openingBalance", "panNumber", "phone", "state", "supplierCode", "supplierName", "taxNumber", "updatedAt" FROM "Supplier";
DROP TABLE "Supplier";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
CREATE UNIQUE INDEX "Supplier_supplierCode_key" ON "Supplier"("supplierCode");
CREATE TABLE "new_SupplierPayment" (
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
    "tdsAmount" REAL NOT NULL DEFAULT 0,
    "tdsSection" TEXT,
    CONSTRAINT "SupplierPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SupplierPayment" ("amount", "billId", "createdAt", "id", "isReversed", "paymentDate", "paymentMethod", "recordedById", "referenceNumber", "remarks", "reversalReason", "supplierId") SELECT "amount", "billId", "createdAt", "id", "isReversed", "paymentDate", "paymentMethod", "recordedById", "referenceNumber", "remarks", "reversalReason", "supplierId" FROM "SupplierPayment";
DROP TABLE "SupplierPayment";
ALTER TABLE "new_SupplierPayment" RENAME TO "SupplierPayment";
CREATE INDEX "SupplierPayment_billId_idx" ON "SupplierPayment"("billId");
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");
CREATE INDEX "SupplierPayment_paymentDate_idx" ON "SupplierPayment"("paymentDate");
CREATE INDEX "SupplierPayment_isReversed_idx" ON "SupplierPayment"("isReversed");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BankAccount_accountType_idx" ON "BankAccount"("accountType");

-- CreateIndex
CREATE INDEX "BankAccount_isActive_idx" ON "BankAccount"("isActive");

-- CreateIndex
CREATE INDEX "BankStatementLine_bankAccountId_idx" ON "BankStatementLine"("bankAccountId");

-- CreateIndex
CREATE INDEX "BankStatementLine_reconciled_idx" ON "BankStatementLine"("reconciled");

-- CreateIndex
CREATE INDEX "BankStatementLine_transactionDate_idx" ON "BankStatementLine"("transactionDate");

-- CreateIndex
CREATE INDEX "BankStatementLine_importBatchId_idx" ON "BankStatementLine"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccounts_accountCode_key" ON "ChartOfAccounts"("accountCode");

-- CreateIndex
CREATE INDEX "ChartOfAccounts_accountType_idx" ON "ChartOfAccounts"("accountType");

-- CreateIndex
CREATE INDEX "ChartOfAccounts_parentId_idx" ON "ChartOfAccounts"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_entryNumber_key" ON "JournalEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "JournalEntry_entryDate_idx" ON "JournalEntry"("entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_sourceType_idx" ON "JournalEntry"("sourceType");

-- CreateIndex
CREATE INDEX "JournalEntryLine_journalEntryId_idx" ON "JournalEntryLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_accountId_idx" ON "JournalEntryLine"("accountId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_bankAccountId_idx" ON "JournalEntryLine"("bankAccountId");

-- CreateIndex
CREATE INDEX "PostDatedCheque_bankAccountId_idx" ON "PostDatedCheque"("bankAccountId");

-- CreateIndex
CREATE INDEX "PostDatedCheque_status_idx" ON "PostDatedCheque"("status");

-- CreateIndex
CREATE INDEX "PostDatedCheque_dueDate_idx" ON "PostDatedCheque"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_assetCode_key" ON "FixedAsset"("assetCode");

-- CreateIndex
CREATE INDEX "FixedAsset_status_idx" ON "FixedAsset"("status");

-- CreateIndex
CREATE INDEX "FixedAsset_category_idx" ON "FixedAsset"("category");

-- CreateIndex
CREATE INDEX "FixedAssetDepreciation_fixedAssetId_idx" ON "FixedAssetDepreciation"("fixedAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetDepreciation_fixedAssetId_periodEnd_key" ON "FixedAssetDepreciation"("fixedAssetId", "periodEnd");

-- The 5 "RedefineIndex" statements `prisma migrate diff` originally generated
-- here (DeliveryTracker/LearnerProfile/StudentProfile/TokenQueue/VisitNote —
-- an unrelated, pre-existing, harmless index-naming drift, not a Phase 62
-- change) were removed after actually running: SQLite rejects a raw
-- `DROP INDEX` on an autoindex backing a UNIQUE column constraint
-- ("index associated with UNIQUE or PRIMARY KEY constraint cannot be
-- dropped") — it needs a full RedefineTables treatment to fix, same as
-- every other column/constraint change in this file, not a bare DROP INDEX.
-- Out of scope for this phase; left as pre-existing, confirmed-harmless
-- drift for a future pass, not silently fixed and not silently ignored.

