-- CreateTable
CREATE TABLE "BankRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'ANY',
    "contains" TEXT NOT NULL DEFAULT '',
    "minAmount" REAL,
    "maxAmount" REAL,
    "accountId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "BankRule_isActive_priority_idx" ON "BankRule"("isActive", "priority");
