-- Phase 67 §9.1 — Agri Inputs items 1+3+5: crop-season credit terms, crop-linked product advisory, equipment AMC/service reminders.
CREATE TABLE "CropSeason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "harvestMonth" INTEGER NOT NULL,
    "harvestDay" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "CropSeason_isActive_idx" ON "CropSeason"("isActive");

ALTER TABLE "Invoice" ADD COLUMN "cropSeasonId" TEXT;
CREATE INDEX "Invoice_cropSeasonId_idx" ON "Invoice"("cropSeasonId");

ALTER TABLE "Product" ADD COLUMN "recommendedCrop" TEXT;

ALTER TABLE "ProductSerial" ADD COLUMN "nextServiceDueDate" DATETIME;
ALTER TABLE "ProductSerial" ADD COLUMN "lastServicedDate" DATETIME;
