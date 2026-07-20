-- AlterTable
ALTER TABLE "ComplianceEvent" ADD COLUMN "agmOffsetDays" INTEGER;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "lastAgmDate" DATETIME;

-- CreateTable
CREATE TABLE "ClientDocumentChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "collectedDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientDocumentChecklistItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ClientDocumentChecklistItem_clientId_idx" ON "ClientDocumentChecklistItem"("clientId");

-- CreateIndex
CREATE INDEX "ClientDocumentChecklistItem_status_idx" ON "ClientDocumentChecklistItem"("status");
