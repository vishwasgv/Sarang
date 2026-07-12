-- AlterTable
ALTER TABLE "Product" ADD COLUMN "grossWeight" REAL;
ALTER TABLE "Product" ADD COLUMN "hallmarkNumber" TEXT;
ALTER TABLE "Product" ADD COLUMN "makingChargeType" TEXT;
ALTER TABLE "Product" ADD COLUMN "makingChargeValue" REAL;
ALTER TABLE "Product" ADD COLUMN "metalType" TEXT;
ALTER TABLE "Product" ADD COLUMN "netWeight" REAL;
ALTER TABLE "Product" ADD COLUMN "purity" TEXT;
ALTER TABLE "Product" ADD COLUMN "stoneWeight" REAL;

-- CreateTable
CREATE TABLE "MetalRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metalType" TEXT NOT NULL,
    "purity" TEXT NOT NULL,
    "ratePerGram" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT
);

-- CreateTable
CREATE TABLE "MetalExchange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exchangeNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "metalType" TEXT NOT NULL,
    "purity" TEXT NOT NULL,
    "grossWeight" REAL NOT NULL,
    "deductionWeight" REAL NOT NULL DEFAULT 0,
    "netWeight" REAL NOT NULL,
    "ratePerGram" REAL NOT NULL,
    "valueGiven" REAL NOT NULL,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "MetalExchange_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MetalRate_metalType_purity_key" ON "MetalRate"("metalType", "purity");

-- CreateIndex
CREATE UNIQUE INDEX "MetalExchange_exchangeNumber_key" ON "MetalExchange"("exchangeNumber");

-- CreateIndex
CREATE INDEX "MetalExchange_customerId_idx" ON "MetalExchange"("customerId");

-- CreateIndex
CREATE INDEX "MetalExchange_invoiceId_idx" ON "MetalExchange"("invoiceId");

-- CreateIndex
CREATE INDEX "MetalExchange_createdAt_idx" ON "MetalExchange"("createdAt");

