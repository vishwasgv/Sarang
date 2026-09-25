-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "currencyCode" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "rateDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_currencyCode_rateDate_key" ON "ExchangeRate"("currencyCode", "rateDate");
