-- CreateTable
CREATE TABLE "PestJobSheetPesticide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobSheetId" TEXT NOT NULL,
    "productId" TEXT,
    "pesticideName" TEXT NOT NULL,
    "quantityUsed" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ML',
    "dosageNote" TEXT,
    "targetPest" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PestJobSheetPesticide_jobSheetId_fkey" FOREIGN KEY ("jobSheetId") REFERENCES "PestJobSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PestJobSheetPesticide_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PestJobSheetPesticide_jobSheetId_idx" ON "PestJobSheetPesticide"("jobSheetId");

-- CreateIndex
CREATE INDEX "PestJobSheetPesticide_productId_idx" ON "PestJobSheetPesticide"("productId");
