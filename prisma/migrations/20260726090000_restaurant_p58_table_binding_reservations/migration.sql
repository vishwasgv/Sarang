-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "reservedFor" DATETIME NOT NULL,
    "tableId" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_splitFromInvoiceId_fkey" FOREIGN KEY ("splitFromInvoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("balanceAmount", "buyerState", "createdAt", "createdById", "customerId", "discountAmount", "dueDate", "gstType", "id", "invoiceDate", "invoiceNumber", "invoiceType", "notes", "originalInvoiceId", "paidAmount", "paymentStatus", "quotationId", "roundingAmount", "status", "subtotal", "taxAmount", "totalAmount", "updatedAt") SELECT "balanceAmount", "buyerState", "createdAt", "createdById", "customerId", "discountAmount", "dueDate", "gstType", "id", "invoiceDate", "invoiceNumber", "invoiceType", "notes", "originalInvoiceId", "paidAmount", "paymentStatus", "quotationId", "roundingAmount", "status", "subtotal", "taxAmount", "totalAmount", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_quotationId_key" ON "Invoice"("quotationId");
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_status_invoiceDate_idx" ON "Invoice"("status", "invoiceDate");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");
CREATE INDEX "Invoice_createdById_idx" ON "Invoice"("createdById");
CREATE INDEX "Invoice_originalInvoiceId_idx" ON "Invoice"("originalInvoiceId");
CREATE INDEX "Invoice_tableId_idx" ON "Invoice"("tableId");
CREATE INDEX "Invoice_splitFromInvoiceId_idx" ON "Invoice"("splitFromInvoiceId");
CREATE TABLE "new_RestaurantTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableNumber" TEXT NOT NULL,
    "tableName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "waiterId" TEXT,
    "currentInvoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantTable_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RestaurantTable_currentInvoiceId_fkey" FOREIGN KEY ("currentInvoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RestaurantTable" ("createdAt", "id", "status", "tableName", "tableNumber", "waiterId") SELECT "createdAt", "id", "status", "tableName", "tableNumber", "waiterId" FROM "RestaurantTable";
DROP TABLE "RestaurantTable";
ALTER TABLE "new_RestaurantTable" RENAME TO "RestaurantTable";
CREATE UNIQUE INDEX "RestaurantTable_tableNumber_key" ON "RestaurantTable"("tableNumber");
CREATE INDEX "RestaurantTable_waiterId_idx" ON "RestaurantTable"("waiterId");
CREATE INDEX "RestaurantTable_currentInvoiceId_idx" ON "RestaurantTable"("currentInvoiceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Reservation_reservedFor_idx" ON "Reservation"("reservedFor");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_tableId_idx" ON "Reservation"("tableId");
