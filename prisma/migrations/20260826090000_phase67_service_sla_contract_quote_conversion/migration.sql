-- Phase 67 §9.1 — Service item 1 (Ticket SLA timer, item 5 quote-to-job conversion) + item 3 (recurring service contract).

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ServiceTicket" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "ticketNumber" TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT,
    "status"       TEXT NOT NULL DEFAULT 'OPEN',
    "priority"     TEXT NOT NULL DEFAULT 'MEDIUM',
    "category"     TEXT,
    "customerId"   TEXT,
    "assignedToId" TEXT,
    "resolvedAt"   DATETIME,
    "closedAt"     DATETIME,
    "resolution"   TEXT,
    "createdById"  TEXT,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL,
    "invoiceId"    TEXT,
    "slaDueAt"     DATETIME,
    "quotationId"  TEXT,
    CONSTRAINT "ServiceTicket_customerId_fkey"   FOREIGN KEY ("customerId")   REFERENCES "Customer"  ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"      ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceTicket_quotationId_fkey"  FOREIGN KEY ("quotationId")  REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceTicket" ("id", "ticketNumber", "title", "description", "status", "priority", "category", "customerId", "assignedToId", "resolvedAt", "closedAt", "resolution", "createdById", "createdAt", "updatedAt", "invoiceId")
SELECT "id", "ticketNumber", "title", "description", "status", "priority", "category", "customerId", "assignedToId", "resolvedAt", "closedAt", "resolution", "createdById", "createdAt", "updatedAt", "invoiceId" FROM "ServiceTicket";
DROP TABLE "ServiceTicket";
ALTER TABLE "new_ServiceTicket" RENAME TO "ServiceTicket";
CREATE UNIQUE INDEX "ServiceTicket_ticketNumber_key" ON "ServiceTicket"("ticketNumber");
CREATE UNIQUE INDEX "ServiceTicket_quotationId_key" ON "ServiceTicket"("quotationId");
CREATE INDEX "ServiceTicket_status_idx" ON "ServiceTicket"("status");
CREATE INDEX "ServiceTicket_customerId_idx" ON "ServiceTicket"("customerId");
CREATE INDEX "ServiceTicket_priority_idx" ON "ServiceTicket"("priority");
CREATE INDEX "ServiceTicket_createdAt_idx" ON "ServiceTicket"("createdAt");
PRAGMA foreign_keys=ON;

-- CreateTable
CREATE TABLE "ServiceContract" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "contractNumber"     TEXT NOT NULL,
    "customerId"         TEXT NOT NULL,
    "scope"              TEXT,
    "serviceFrequency"   TEXT NOT NULL DEFAULT 'MONTHLY',
    "startDate"          DATETIME NOT NULL,
    "endDate"            DATETIME,
    "contractValue"      REAL NOT NULL,
    "status"             TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes"              TEXT,
    "lastInvoicedPeriod" TEXT,
    "createdById"        TEXT,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          DATETIME NOT NULL,
    CONSTRAINT "ServiceContract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ServiceContract_contractNumber_key" ON "ServiceContract"("contractNumber");
CREATE INDEX "ServiceContract_customerId_idx" ON "ServiceContract"("customerId");
CREATE INDEX "ServiceContract_status_idx" ON "ServiceContract"("status");
