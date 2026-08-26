-- Phase 67 §9.1 — Footwear: trial-pair counter workflow.
CREATE TABLE "TrialSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "triedVariantIds" TEXT NOT NULL,
    "purchasedVariantId" TEXT,
    "customerId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrialSession_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TrialSession_productId_idx" ON "TrialSession"("productId");
CREATE INDEX "TrialSession_createdAt_idx" ON "TrialSession"("createdAt");
