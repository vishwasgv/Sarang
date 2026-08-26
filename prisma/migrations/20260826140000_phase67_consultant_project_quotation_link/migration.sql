-- Phase 67 §9.1 — Consultant item 1: engagement-letter -> project
-- auto-conversion. Adds Project.quotationId (nullable, unique) with a real
-- FK to Quotation (ON DELETE SET NULL), same shape as Service item 5's
-- ServiceTicket.quotationId. Hand-written RedefineTables block (not
-- `prisma migrate dev`) because this dev DB's own drift-detection check
-- reports an unrelated false-positive on this long-lived database — the
-- same known workaround already used for Jewellery's and Service's own
-- migrations this session.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Project" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "projectNumber"   TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "description"     TEXT,
    "status"          TEXT NOT NULL DEFAULT 'OPEN',
    "priority"        TEXT NOT NULL DEFAULT 'MEDIUM',
    "customerId"      TEXT,
    "assignedToId"    TEXT,
    "estimatedHours"  REAL NOT NULL DEFAULT 0,
    "estimatedAmount" REAL NOT NULL DEFAULT 0,
    "startDate"       DATETIME,
    "dueDate"         DATETIME,
    "completedDate"   DATETIME,
    "notes"           TEXT,
    "createdById"     TEXT,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL,
    "invoiceId"       TEXT,
    "quotationId"     TEXT,
    CONSTRAINT "Project_customerId_fkey"   FOREIGN KEY ("customerId")   REFERENCES "Customer"  ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"      ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_quotationId_fkey"  FOREIGN KEY ("quotationId")  REFERENCES "Quotation"  ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Project" (
    "id", "projectNumber", "title", "description", "status", "priority",
    "customerId", "assignedToId", "estimatedHours", "estimatedAmount",
    "startDate", "dueDate", "completedDate", "notes", "createdById",
    "createdAt", "updatedAt", "invoiceId"
)
SELECT
    "id", "projectNumber", "title", "description", "status", "priority",
    "customerId", "assignedToId", "estimatedHours", "estimatedAmount",
    "startDate", "dueDate", "completedDate", "notes", "createdById",
    "createdAt", "updatedAt", "invoiceId"
FROM "Project";

DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";

CREATE UNIQUE INDEX "Project_projectNumber_key" ON "Project"("projectNumber");
CREATE UNIQUE INDEX "Project_quotationId_key"   ON "Project"("quotationId");
CREATE INDEX "Project_status_idx"     ON "Project"("status");
CREATE INDEX "Project_customerId_idx" ON "Project"("customerId");
CREATE INDEX "Project_createdAt_idx"  ON "Project"("createdAt");

PRAGMA foreign_keys=ON;
