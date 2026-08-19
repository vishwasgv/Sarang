-- Phase 67 item — Retail simple visit-based loyalty punch-card. Singleton
-- LoyaltyProgram config row, per-customer LoyaltyCard punch balance, an
-- append-only LoyaltyPunchEvent history, and LoyaltyRedemption history.
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "punchesRequired" INTEGER NOT NULL DEFAULT 10,
    "rewardDescription" TEXT NOT NULL,
    "minPurchaseAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "LoyaltyCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "currentPunches" INTEGER NOT NULL DEFAULT 0,
    "totalPunchesEarned" INTEGER NOT NULL DEFAULT 0,
    "totalRewardsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "lastPunchAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoyaltyCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LoyaltyCard_customerId_key" ON "LoyaltyCard"("customerId");
CREATE INDEX "LoyaltyCard_customerId_idx" ON "LoyaltyCard"("customerId");

CREATE TABLE "LoyaltyPunchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loyaltyCardId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyPunchEvent_loyaltyCardId_fkey" FOREIGN KEY ("loyaltyCardId") REFERENCES "LoyaltyCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LoyaltyPunchEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "LoyaltyPunchEvent_loyaltyCardId_idx" ON "LoyaltyPunchEvent"("loyaltyCardId");

CREATE TABLE "LoyaltyRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loyaltyCardId" TEXT NOT NULL,
    "punchesUsed" INTEGER NOT NULL,
    "rewardDescription" TEXT NOT NULL,
    "redeemedById" TEXT,
    "redeemedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyRedemption_loyaltyCardId_fkey" FOREIGN KEY ("loyaltyCardId") REFERENCES "LoyaltyCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LoyaltyRedemption_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "LoyaltyRedemption_loyaltyCardId_idx" ON "LoyaltyRedemption"("loyaltyCardId");
