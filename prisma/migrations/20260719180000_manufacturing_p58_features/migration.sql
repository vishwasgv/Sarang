-- Phase 58 §2 — Manufacturing: multi-level BOM, labor costing, scrap
-- tracking, QC gate, raw-material lot/batch traceability

-- CreateTable
CREATE TABLE "ProductionMaterialBatchConsumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productionMaterialUsageId" TEXT NOT NULL,
    "rawMaterialBatchId" TEXT NOT NULL,
    "quantityConsumed" REAL NOT NULL,
    CONSTRAINT "ProductionMaterialBatchConsumption_productionMaterialUsageId_fkey" FOREIGN KEY ("productionMaterialUsageId") REFERENCES "ProductionMaterialUsage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionMaterialBatchConsumption_rawMaterialBatchId_fkey" FOREIGN KEY ("rawMaterialBatchId") REFERENCES "RawMaterialBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawMaterialBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rawMaterialId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "receivedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantityReceived" REAL NOT NULL,
    "quantityRemaining" REAL NOT NULL,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawMaterialBatch_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RawMaterialBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BillOfMaterialItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bomId" TEXT NOT NULL,
    "rawMaterialId" TEXT,
    "componentProductId" TEXT,
    "quantityNeeded" REAL NOT NULL,
    "wastagePercent" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "BillOfMaterialItem_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BillOfMaterial" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillOfMaterialItem_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BillOfMaterialItem_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BillOfMaterialItem" ("bomId", "id", "quantityNeeded", "rawMaterialId", "wastagePercent") SELECT "bomId", "id", "quantityNeeded", "rawMaterialId", "wastagePercent" FROM "BillOfMaterialItem";
DROP TABLE "BillOfMaterialItem";
ALTER TABLE "new_BillOfMaterialItem" RENAME TO "BillOfMaterialItem";
CREATE INDEX "BillOfMaterialItem_bomId_idx" ON "BillOfMaterialItem"("bomId");
CREATE INDEX "BillOfMaterialItem_componentProductId_idx" ON "BillOfMaterialItem"("componentProductId");
CREATE TABLE "new_ProductionMaterialUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productionOrderId" TEXT NOT NULL,
    "rawMaterialId" TEXT,
    "componentProductId" TEXT,
    "quantityPlanned" REAL NOT NULL,
    "quantityActual" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ProductionMaterialUsage_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionMaterialUsage_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionMaterialUsage_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductionMaterialUsage" ("id", "productionOrderId", "quantityActual", "quantityPlanned", "rawMaterialId") SELECT "id", "productionOrderId", "quantityActual", "quantityPlanned", "rawMaterialId" FROM "ProductionMaterialUsage";
DROP TABLE "ProductionMaterialUsage";
ALTER TABLE "new_ProductionMaterialUsage" RENAME TO "ProductionMaterialUsage";
CREATE INDEX "ProductionMaterialUsage_productionOrderId_idx" ON "ProductionMaterialUsage"("productionOrderId");
CREATE TABLE "new_ProductionOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "plannedQty" REAL NOT NULL,
    "producedQty" REAL NOT NULL DEFAULT 0,
    "scrapQty" REAL NOT NULL DEFAULT 0,
    "laborCost" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" DATETIME,
    "completedDate" DATETIME,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionOrder_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BillOfMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProductionOrder" ("bomId", "completedDate", "createdAt", "createdById", "id", "notes", "orderNumber", "plannedQty", "producedQty", "productId", "startDate", "status", "updatedAt") SELECT "bomId", "completedDate", "createdAt", "createdById", "id", "notes", "orderNumber", "plannedQty", "producedQty", "productId", "startDate", "status", "updatedAt" FROM "ProductionOrder";
DROP TABLE "ProductionOrder";
ALTER TABLE "new_ProductionOrder" RENAME TO "ProductionOrder";
CREATE UNIQUE INDEX "ProductionOrder_orderNumber_key" ON "ProductionOrder"("orderNumber");
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");
CREATE INDEX "ProductionOrder_productId_idx" ON "ProductionOrder"("productId");
CREATE INDEX "ProductionOrder_createdAt_idx" ON "ProductionOrder"("createdAt");
CREATE TABLE "new_WorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productionOrderId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "taskName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isQcStep" BOOLEAN NOT NULL DEFAULT false,
    "qcResult" TEXT,
    "qcNotes" TEXT,
    "notes" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkOrder_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkOrder" ("completedAt", "createdAt", "id", "notes", "productionOrderId", "status", "stepNumber", "taskName", "updatedAt") SELECT "completedAt", "createdAt", "id", "notes", "productionOrderId", "status", "stepNumber", "taskName", "updatedAt" FROM "WorkOrder";
DROP TABLE "WorkOrder";
ALTER TABLE "new_WorkOrder" RENAME TO "WorkOrder";
CREATE INDEX "WorkOrder_productionOrderId_idx" ON "WorkOrder"("productionOrderId");
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");
CREATE UNIQUE INDEX "WorkOrder_productionOrderId_stepNumber_key" ON "WorkOrder"("productionOrderId", "stepNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProductionMaterialBatchConsumption_productionMaterialUsageId_idx" ON "ProductionMaterialBatchConsumption"("productionMaterialUsageId");

-- CreateIndex
CREATE INDEX "ProductionMaterialBatchConsumption_rawMaterialBatchId_idx" ON "ProductionMaterialBatchConsumption"("rawMaterialBatchId");

-- CreateIndex
CREATE INDEX "RawMaterialBatch_rawMaterialId_idx" ON "RawMaterialBatch"("rawMaterialId");

-- CreateIndex
CREATE INDEX "RawMaterialBatch_isActive_idx" ON "RawMaterialBatch"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RawMaterialBatch_rawMaterialId_batchNumber_key" ON "RawMaterialBatch"("rawMaterialId", "batchNumber");
