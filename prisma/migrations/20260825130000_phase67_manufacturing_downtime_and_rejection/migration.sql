-- Phase 67 §9.1 — Manufacturing item 1 (downtime capture) + item 3 (per-stage rejection tracking).
ALTER TABLE "WorkOrder" ADD COLUMN "qtyInspected" REAL;
ALTER TABLE "WorkOrder" ADD COLUMN "qtyRejected" REAL;

CREATE TABLE "WorkOrderDowntimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "minutes" REAL NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkOrderDowntimeEntry_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WorkOrderDowntimeEntry_workOrderId_idx" ON "WorkOrderDowntimeEntry"("workOrderId");
CREATE INDEX "WorkOrderDowntimeEntry_createdAt_idx" ON "WorkOrderDowntimeEntry"("createdAt");
