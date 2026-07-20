-- AlterTable
ALTER TABLE "Product" ADD COLUMN "mrp" REAL;

-- CreateTable
CREATE TABLE "HeldSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT,
    "customerId" TEXT,
    "cartJson" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "totalAmount" REAL NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HeldSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HeldSale_createdAt_idx" ON "HeldSale"("createdAt");
