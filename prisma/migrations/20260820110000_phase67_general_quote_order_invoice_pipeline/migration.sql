-- Phase 67 item — General's Universal Quote -> Order -> Invoice pipeline.
-- Quotation already converts directly to Invoice (Invoice.quotationId), and
-- SalesOrder already converts to Invoice (Invoice.salesOrderId, partial-
-- invoicing aware) — but nothing ever connected Quotation to SalesOrder, so
-- there was no way to chain all three. Adds SalesOrder.quotationId (1:1,
-- same shape as Invoice.quotationId above it) so a Quotation can now
-- optionally become a SalesOrder first, then use SalesOrder's own existing
-- invoice-generation flow to finish the chain.
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SalesOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "soNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "quotationId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalesOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SalesOrder" ("id", "soNumber", "customerId", "orderDate", "expectedDate", "status", "subtotal", "taxAmount", "totalAmount", "notes", "createdById", "createdAt", "updatedAt") SELECT "id", "soNumber", "customerId", "orderDate", "expectedDate", "status", "subtotal", "taxAmount", "totalAmount", "notes", "createdById", "createdAt", "updatedAt" FROM "SalesOrder";
DROP TABLE "SalesOrder";
ALTER TABLE "new_SalesOrder" RENAME TO "SalesOrder";
CREATE UNIQUE INDEX "SalesOrder_soNumber_key" ON "SalesOrder"("soNumber");
CREATE UNIQUE INDEX "SalesOrder_quotationId_key" ON "SalesOrder"("quotationId");
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");
CREATE INDEX "SalesOrder_orderDate_idx" ON "SalesOrder"("orderDate");
PRAGMA foreign_keys=ON;
