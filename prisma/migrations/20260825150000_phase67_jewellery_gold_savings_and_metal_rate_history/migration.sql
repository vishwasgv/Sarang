-- Phase 67 §9.1 — Jewellery item 1 (gold savings/chit scheme ledger) + item 4's own rate-history prerequisite.
CREATE TABLE "GoldSavingsScheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "metalType" TEXT NOT NULL,
    "monthlyAmount" REAL NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalDeposited" REAL NOT NULL DEFAULT 0,
    "bonusAmount" REAL NOT NULL DEFAULT 0,
    "redeemedAmount" REAL,
    "redeemedAt" DATETIME,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "GoldSavingsScheme_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GoldSavingsScheme_schemeNumber_key" ON "GoldSavingsScheme"("schemeNumber");
CREATE INDEX "GoldSavingsScheme_customerId_idx" ON "GoldSavingsScheme"("customerId");
CREATE INDEX "GoldSavingsScheme_status_idx" ON "GoldSavingsScheme"("status");

CREATE TABLE "GoldSavingsInstallment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "GoldSavingsInstallment_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "GoldSavingsScheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GoldSavingsInstallment_schemeId_idx" ON "GoldSavingsInstallment"("schemeId");

CREATE TABLE "MetalRateHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metalType" TEXT NOT NULL,
    "purity" TEXT NOT NULL,
    "ratePerGram" REAL NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "MetalRateHistory_metalType_purity_recordedAt_idx" ON "MetalRateHistory"("metalType", "purity", "recordedAt");
