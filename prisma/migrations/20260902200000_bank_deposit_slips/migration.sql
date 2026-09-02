-- 2026-09-02 — Bank Deposit Slips: cash/cheque deposit-slip generation
-- from note denominations, closing a gap named directly in the 43-vertical
-- audit's Tally comparison ("Cheque book management" was the twin item,
-- closed 2026-08-12; this is the other half). Only the cash portion posts
-- real money immediately; cheques attached are linked for the paper trail
-- only and still post their own GL entry later when they actually clear.

-- CreateTable
CREATE TABLE "BankDeposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "depositNumber" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "depositDate" DATETIME NOT NULL,
    "denominations" TEXT NOT NULL,
    "cashTotal" REAL NOT NULL DEFAULT 0,
    "chequeTotal" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankDeposit_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BankDeposit_depositNumber_key" ON "BankDeposit"("depositNumber");
CREATE INDEX "BankDeposit_bankAccountId_idx" ON "BankDeposit"("bankAccountId");
CREATE INDEX "BankDeposit_depositDate_idx" ON "BankDeposit"("depositDate");

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
    "bankDepositId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostDatedCheque_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PostDatedCheque_chequeBookId_fkey" FOREIGN KEY ("chequeBookId") REFERENCES "ChequeBook" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PostDatedCheque_bankDepositId_fkey" FOREIGN KEY ("bankDepositId") REFERENCES "BankDeposit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PostDatedCheque" ("id", "bankAccountId", "chequeNumber", "chequeBookId", "direction", "partyType", "partyId", "dueDate", "amount", "status", "remarks", "createdById", "createdAt", "updatedAt") SELECT "id", "bankAccountId", "chequeNumber", "chequeBookId", "direction", "partyType", "partyId", "dueDate", "amount", "status", "remarks", "createdById", "createdAt", "updatedAt" FROM "PostDatedCheque";
DROP TABLE "PostDatedCheque";
ALTER TABLE "new_PostDatedCheque" RENAME TO "PostDatedCheque";
CREATE INDEX "PostDatedCheque_bankAccountId_idx" ON "PostDatedCheque"("bankAccountId");
CREATE INDEX "PostDatedCheque_status_idx" ON "PostDatedCheque"("status");
CREATE INDEX "PostDatedCheque_dueDate_idx" ON "PostDatedCheque"("dueDate");
CREATE INDEX "PostDatedCheque_chequeBookId_idx" ON "PostDatedCheque"("chequeBookId");
CREATE INDEX "PostDatedCheque_bankDepositId_idx" ON "PostDatedCheque"("bankDepositId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
