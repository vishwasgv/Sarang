-- CreateTable
CREATE TABLE "ProductBin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "binCode" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductBin_productId_locationId_key" ON "ProductBin"("productId", "locationId");

-- CreateIndex
CREATE INDEX "ProductBin_locationId_binCode_idx" ON "ProductBin"("locationId", "binCode");
