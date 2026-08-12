-- Phase 62 gap-closing pass: cheque-book / number-sequence tracking
-- (Section 4.1 item 7 promised this and it was never built)

-- CreateTable
CREATE TABLE "ChequeBook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankAccountId" TEXT NOT NULL,
    "startNumber" INTEGER NOT NULL,
    "endNumber" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChequeBook_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PostDatedCheque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankAccountId" TEXT NOT NULL,
    "chequeNumber" TEXT NOT NULL,
    "chequeBookId" TEXT,
    "direction" TEXT NOT NULL,
    "partyType" TEXT,
    "partyId" TEXT,
    "dueDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostDatedCheque_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PostDatedCheque_chequeBookId_fkey" FOREIGN KEY ("chequeBookId") REFERENCES "ChequeBook" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PostDatedCheque" ("amount", "bankAccountId", "chequeNumber", "createdAt", "createdById", "direction", "dueDate", "id", "partyId", "partyType", "remarks", "status", "updatedAt") SELECT "amount", "bankAccountId", "chequeNumber", "createdAt", "createdById", "direction", "dueDate", "id", "partyId", "partyType", "remarks", "status", "updatedAt" FROM "PostDatedCheque";
DROP TABLE "PostDatedCheque";
ALTER TABLE "new_PostDatedCheque" RENAME TO "PostDatedCheque";
CREATE INDEX "PostDatedCheque_bankAccountId_idx" ON "PostDatedCheque"("bankAccountId");
CREATE INDEX "PostDatedCheque_status_idx" ON "PostDatedCheque"("status");
CREATE INDEX "PostDatedCheque_dueDate_idx" ON "PostDatedCheque"("dueDate");
CREATE INDEX "PostDatedCheque_chequeBookId_idx" ON "PostDatedCheque"("chequeBookId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ChequeBook_bankAccountId_idx" ON "ChequeBook"("bankAccountId");

-- CreateIndex
CREATE INDEX "ChequeBook_isActive_idx" ON "ChequeBook"("isActive");
