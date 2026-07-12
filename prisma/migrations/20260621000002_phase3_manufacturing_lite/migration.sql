-- Phase 3: Manufacturing Lite
-- RawMaterial, RawMaterialMovement, BillOfMaterial, BillOfMaterialItem, ProductionOrder, ProductionMaterialUsage

CREATE TABLE "RawMaterial" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "name"         TEXT NOT NULL,
    "unit"         TEXT NOT NULL DEFAULT 'kg',
    "currentStock" REAL NOT NULL DEFAULT 0,
    "reorderLevel" REAL NOT NULL DEFAULT 0,
    "unitCost"     REAL NOT NULL DEFAULT 0,
    "supplierId"   TEXT,
    "isActive"     BOOLEAN NOT NULL DEFAULT 1,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL,
    CONSTRAINT "RawMaterial_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RawMaterialMovement" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "rawMaterialId" TEXT NOT NULL,
    "type"          TEXT NOT NULL,
    "quantity"      REAL NOT NULL,
    "balanceAfter"  REAL NOT NULL DEFAULT 0,
    "reference"     TEXT,
    "unitCost"      REAL NOT NULL DEFAULT 0,
    "notes"         TEXT,
    "createdById"   TEXT,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawMaterialMovement_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BillOfMaterial" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "productId"   TEXT NOT NULL,
    "description" TEXT,
    "outputQty"   REAL NOT NULL DEFAULT 1,
    "isActive"    BOOLEAN NOT NULL DEFAULT 1,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL,
    CONSTRAINT "BillOfMaterial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BillOfMaterial_productId_key" ON "BillOfMaterial"("productId");

CREATE TABLE "BillOfMaterialItem" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "bomId"          TEXT NOT NULL,
    "rawMaterialId"  TEXT NOT NULL,
    "quantityNeeded" REAL NOT NULL,
    "wastagePercent" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "BillOfMaterialItem_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BillOfMaterial" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillOfMaterialItem_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BillOfMaterialItem_bomId_rawMaterialId_key" ON "BillOfMaterialItem"("bomId", "rawMaterialId");
CREATE INDEX "BillOfMaterialItem_bomId_idx" ON "BillOfMaterialItem"("bomId");

CREATE TABLE "ProductionOrder" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "orderNumber"   TEXT NOT NULL,
    "productId"     TEXT NOT NULL,
    "bomId"         TEXT NOT NULL,
    "plannedQty"    REAL NOT NULL,
    "producedQty"   REAL NOT NULL DEFAULT 0,
    "status"        TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate"     DATETIME,
    "completedDate" DATETIME,
    "notes"         TEXT,
    "createdById"   TEXT,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL,
    CONSTRAINT "ProductionOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionOrder_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BillOfMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProductionOrder_orderNumber_key" ON "ProductionOrder"("orderNumber");
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");
CREATE INDEX "ProductionOrder_productId_idx" ON "ProductionOrder"("productId");
CREATE INDEX "ProductionOrder_createdAt_idx" ON "ProductionOrder"("createdAt");

CREATE TABLE "ProductionMaterialUsage" (
    "id"                TEXT NOT NULL PRIMARY KEY,
    "productionOrderId" TEXT NOT NULL,
    "rawMaterialId"     TEXT NOT NULL,
    "quantityPlanned"   REAL NOT NULL,
    "quantityActual"    REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ProductionMaterialUsage_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionMaterialUsage_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProductionMaterialUsage_productionOrderId_rawMaterialId_key" ON "ProductionMaterialUsage"("productionOrderId", "rawMaterialId");
CREATE INDEX "ProductionMaterialUsage_productionOrderId_idx" ON "ProductionMaterialUsage"("productionOrderId");

-- Indexes on RawMaterial and RawMaterialMovement
CREATE INDEX "RawMaterial_isActive_idx" ON "RawMaterial"("isActive");
CREATE INDEX "RawMaterial_supplierId_idx" ON "RawMaterial"("supplierId");
CREATE INDEX "RawMaterialMovement_rawMaterialId_idx" ON "RawMaterialMovement"("rawMaterialId");
CREATE INDEX "RawMaterialMovement_type_idx" ON "RawMaterialMovement"("type");
CREATE INDEX "RawMaterialMovement_createdAt_idx" ON "RawMaterialMovement"("createdAt");
CREATE INDEX "BillOfMaterial_isActive_idx" ON "BillOfMaterial"("isActive");
