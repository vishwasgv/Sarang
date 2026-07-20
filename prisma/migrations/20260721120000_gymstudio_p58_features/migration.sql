-- Phase 58 §2 — Gym/Studio: standing trainer-client PT package assignment
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClientSessionPack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "packName" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "usedSessions" INTEGER NOT NULL DEFAULT 0,
    "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" DATETIME,
    "pricePerPack" DECIMAL NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 18,
    "sacCode" TEXT,
    "invoiceId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedTrainerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientSessionPack_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientSessionPack_assignedTrainerId_fkey" FOREIGN KEY ("assignedTrainerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ClientSessionPack" ("createdAt", "customerId", "expiryDate", "id", "invoiceId", "isActive", "notes", "packName", "pricePerPack", "purchaseDate", "sacCode", "taxRate", "totalSessions", "updatedAt", "usedSessions") SELECT "createdAt", "customerId", "expiryDate", "id", "invoiceId", "isActive", "notes", "packName", "pricePerPack", "purchaseDate", "sacCode", "taxRate", "totalSessions", "updatedAt", "usedSessions" FROM "ClientSessionPack";
DROP TABLE "ClientSessionPack";
ALTER TABLE "new_ClientSessionPack" RENAME TO "ClientSessionPack";
CREATE INDEX "ClientSessionPack_customerId_idx" ON "ClientSessionPack"("customerId");
CREATE INDEX "ClientSessionPack_isActive_idx" ON "ClientSessionPack"("isActive");
CREATE INDEX "ClientSessionPack_expiryDate_idx" ON "ClientSessionPack"("expiryDate");
CREATE INDEX "ClientSessionPack_assignedTrainerId_idx" ON "ClientSessionPack"("assignedTrainerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
