-- Phase 58 §2 — Diagnostic Lab: critical/panic-value tier + escalation workflow
ALTER TABLE "NormalRangeReference" ADD COLUMN "criticalHigh" REAL;
ALTER TABLE "NormalRangeReference" ADD COLUMN "criticalLow" REAL;

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LabTestOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labTestOrderId" TEXT NOT NULL,
    "serviceCatalogId" TEXT,
    "testName" TEXT NOT NULL,
    "category" TEXT,
    "sampleType" TEXT NOT NULL DEFAULT 'BLOOD',
    "price" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resultParameters" TEXT NOT NULL DEFAULT '[]',
    "resultSummary" TEXT,
    "hasCriticalResult" BOOLEAN NOT NULL DEFAULT false,
    "criticalNotifiedAt" DATETIME,
    "criticalNotifiedById" TEXT,
    "criticalNotifiedNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LabTestOrderItem_labTestOrderId_fkey" FOREIGN KEY ("labTestOrderId") REFERENCES "LabTestOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LabTestOrderItem_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LabTestOrderItem_criticalNotifiedById_fkey" FOREIGN KEY ("criticalNotifiedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LabTestOrderItem" ("category", "createdAt", "id", "labTestOrderId", "price", "resultParameters", "resultSummary", "sampleType", "serviceCatalogId", "status", "testName", "updatedAt") SELECT "category", "createdAt", "id", "labTestOrderId", "price", "resultParameters", "resultSummary", "sampleType", "serviceCatalogId", "status", "testName", "updatedAt" FROM "LabTestOrderItem";
DROP TABLE "LabTestOrderItem";
ALTER TABLE "new_LabTestOrderItem" RENAME TO "LabTestOrderItem";
CREATE INDEX "LabTestOrderItem_labTestOrderId_idx" ON "LabTestOrderItem"("labTestOrderId");
CREATE INDEX "LabTestOrderItem_status_idx" ON "LabTestOrderItem"("status");
CREATE INDEX "LabTestOrderItem_hasCriticalResult_idx" ON "LabTestOrderItem"("hasCriticalResult");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
