-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimantName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "claimDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "decisionNote" TEXT,
    "expenseId" TEXT,
    "submittedById" TEXT,
    "decidedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ExpenseClaim_status_idx" ON "ExpenseClaim"("status");
