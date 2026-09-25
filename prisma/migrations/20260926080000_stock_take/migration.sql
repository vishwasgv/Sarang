CREATE TABLE "StockTake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "takeNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" DATETIME
);
CREATE UNIQUE INDEX "StockTake_takeNumber_key" ON "StockTake"("takeNumber");
CREATE INDEX "StockTake_status_idx" ON "StockTake"("status");
CREATE INDEX "StockTake_postedAt_idx" ON "StockTake"("postedAt");
CREATE TABLE "StockTakeLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockTakeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "systemQty" REAL NOT NULL,
    "countedQty" REAL,
    "posted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "StockTakeLine_stockTakeId_fkey" FOREIGN KEY ("stockTakeId") REFERENCES "StockTake" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StockTakeLine_stockTakeId_idx" ON "StockTakeLine"("stockTakeId");
CREATE UNIQUE INDEX "StockTakeLine_stockTakeId_productId_key" ON "StockTakeLine"("stockTakeId", "productId");
