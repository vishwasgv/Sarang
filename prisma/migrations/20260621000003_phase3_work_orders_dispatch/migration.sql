-- Phase 3 Addendum: WorkOrder, DispatchRecord

CREATE TABLE "WorkOrder" (
    "id"                TEXT NOT NULL PRIMARY KEY,
    "productionOrderId" TEXT NOT NULL,
    "stepNumber"        INTEGER NOT NULL,
    "taskName"          TEXT NOT NULL,
    "status"            TEXT NOT NULL DEFAULT 'PENDING',
    "notes"             TEXT,
    "completedAt"       DATETIME,
    "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         DATETIME NOT NULL,
    CONSTRAINT "WorkOrder_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkOrder_productionOrderId_stepNumber_key" ON "WorkOrder"("productionOrderId", "stepNumber");
CREATE INDEX "WorkOrder_productionOrderId_idx" ON "WorkOrder"("productionOrderId");
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

CREATE TABLE "DispatchRecord" (
    "id"                TEXT NOT NULL PRIMARY KEY,
    "dispatchNumber"    TEXT NOT NULL,
    "productId"         TEXT NOT NULL,
    "productionOrderId" TEXT,
    "quantity"          REAL NOT NULL,
    "customerId"        TEXT,
    "destination"       TEXT,
    "status"            TEXT NOT NULL DEFAULT 'READY',
    "dispatchDate"      DATETIME,
    "deliveryDate"      DATETIME,
    "notes"             TEXT,
    "createdById"       TEXT,
    "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         DATETIME NOT NULL,
    CONSTRAINT "DispatchRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DispatchRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DispatchRecord_dispatchNumber_key" ON "DispatchRecord"("dispatchNumber");
CREATE INDEX "DispatchRecord_status_idx" ON "DispatchRecord"("status");
CREATE INDEX "DispatchRecord_productId_idx" ON "DispatchRecord"("productId");
CREATE INDEX "DispatchRecord_createdAt_idx" ON "DispatchRecord"("createdAt");
