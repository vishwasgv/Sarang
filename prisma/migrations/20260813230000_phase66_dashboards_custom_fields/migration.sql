-- Phase 66 — Per-Vertical Dashboards & Custom Fields
-- Note: the raw `prisma migrate diff` output also included 5 unrelated
-- "RedefineIndex" blocks (DROP INDEX on a sqlite_autoindex_* backing a
-- UNIQUE constraint, for DeliveryTracker/LearnerProfile/StudentProfile/
-- TokenQueue/VisitNote) — pre-existing schema drift unrelated to this
-- phase, SQLite refuses to drop an autoindex backing a UNIQUE constraint.
-- Stripped here, same as Phase 65's own migration handled the identical
-- 5 blocks.

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "customFields" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "customFields" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "customFields" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "customFields" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "customFields" TEXT;

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "selectOptions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_entityType_idx" ON "CustomFieldDefinition"("entityType");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_entityType_isActive_idx" ON "CustomFieldDefinition"("entityType", "isActive");
