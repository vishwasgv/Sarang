-- Phase 48 — Clothing & Tailoring Vertical Depth
-- All columns nullable/optional, no default forced, additive only.

ALTER TABLE "MeasurementRecord" ADD COLUMN "armhole" DECIMAL;
ALTER TABLE "MeasurementRecord" ADD COLUMN "backNeckDepth" DECIMAL;
ALTER TABLE "MeasurementRecord" ADD COLUMN "cuff" DECIMAL;
ALTER TABLE "MeasurementRecord" ADD COLUMN "frontNeckDepth" DECIMAL;
ALTER TABLE "MeasurementRecord" ADD COLUMN "garmentLength" DECIMAL;

ALTER TABLE "Product" ADD COLUMN "gender" TEXT;

ALTER TABLE "TailoringOrder" ADD COLUMN "gender" TEXT;
ALTER TABLE "TailoringOrder" ADD COLUMN "styleRegion" TEXT;
