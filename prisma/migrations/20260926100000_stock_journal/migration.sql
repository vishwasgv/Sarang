-- CreateTable
CREATE TABLE "StockJournal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalNumber" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StockJournalLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockJournalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitCost" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "StockJournalLine_stockJournalId_fkey" FOREIGN KEY ("stockJournalId") REFERENCES "StockJournal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StockJournal_journalNumber_key" ON "StockJournal"("journalNumber");

-- CreateIndex
CREATE INDEX "StockJournal_createdAt_idx" ON "StockJournal"("createdAt");

-- CreateIndex
CREATE INDEX "StockJournalLine_stockJournalId_idx" ON "StockJournalLine"("stockJournalId");

-- CreateIndex
CREATE INDEX "StockJournalLine_productId_idx" ON "StockJournalLine"("productId");
