-- AlterTable
ALTER TABLE "CustomFieldDefinition" ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CustomFieldDefinition" ADD COLUMN "minValue" REAL;
ALTER TABLE "CustomFieldDefinition" ADD COLUMN "maxValue" REAL;
ALTER TABLE "CustomFieldDefinition" ADD COLUMN "pattern" TEXT;
ALTER TABLE "CustomFieldDefinition" ADD COLUMN "patternHint" TEXT;
