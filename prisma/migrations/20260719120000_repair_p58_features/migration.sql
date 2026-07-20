-- CreateTable
CREATE TABLE "JobCardPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobCardId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobCardPart_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobCardPart_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JobCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itemDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "customerId" TEXT,
    "assignedToId" TEXT,
    "estimatedCost" REAL NOT NULL DEFAULT 0,
    "actualCost" REAL NOT NULL DEFAULT 0,
    "receivedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" DATETIME,
    "deliveredDate" DATETIME,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdById" TEXT,
    "invoiceId" TEXT,
    "warrantyDays" INTEGER,
    "warrantyExpiryDate" DATETIME,
    "warrantyClaimAgainstId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JobCard_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JobCard_warrantyClaimAgainstId_fkey" FOREIGN KEY ("warrantyClaimAgainstId") REFERENCES "JobCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JobCard" ("actualCost", "assignedToId", "createdAt", "createdById", "customerId", "deliveredDate", "estimatedCost", "expectedDate", "id", "internalNotes", "invoiceId", "itemDescription", "jobNumber", "notes", "priority", "receivedDate", "status", "title", "updatedAt") SELECT "actualCost", "assignedToId", "createdAt", "createdById", "customerId", "deliveredDate", "estimatedCost", "expectedDate", "id", "internalNotes", "invoiceId", "itemDescription", "jobNumber", "notes", "priority", "receivedDate", "status", "title", "updatedAt" FROM "JobCard";
DROP TABLE "JobCard";
ALTER TABLE "new_JobCard" RENAME TO "JobCard";
CREATE UNIQUE INDEX "JobCard_jobNumber_key" ON "JobCard"("jobNumber");
CREATE INDEX "JobCard_status_idx" ON "JobCard"("status");
CREATE INDEX "JobCard_customerId_idx" ON "JobCard"("customerId");
CREATE INDEX "JobCard_createdAt_idx" ON "JobCard"("createdAt");
CREATE INDEX "JobCard_warrantyClaimAgainstId_idx" ON "JobCard"("warrantyClaimAgainstId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "JobCardPart_jobCardId_idx" ON "JobCardPart"("jobCardId");

-- CreateIndex
CREATE INDEX "JobCardPart_productId_idx" ON "JobCardPart"("productId");
