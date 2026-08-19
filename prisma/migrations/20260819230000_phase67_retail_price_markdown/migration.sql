-- Phase 67 item — Retail time-boxed markdown workflow. Mirrors
-- RecurringProfile's "no real cron" evaluation shape.
CREATE TABLE "PriceMarkdown" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "originalPrice" REAL NOT NULL,
    "markdownPrice" REAL NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revertedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PriceMarkdown_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PriceMarkdown_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PriceMarkdown_productId_idx" ON "PriceMarkdown"("productId");
CREATE INDEX "PriceMarkdown_status_idx" ON "PriceMarkdown"("status");
CREATE INDEX "PriceMarkdown_endDate_idx" ON "PriceMarkdown"("endDate");
