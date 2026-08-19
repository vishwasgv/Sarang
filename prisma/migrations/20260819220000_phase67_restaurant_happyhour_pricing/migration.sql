-- Phase 67 item 21.x — Restaurant happy-hour pricing windows.
-- Adds a flat-percent-off rule type plus an optional time-of-day window
-- (minutes since midnight) that gates ANY PricingScheme rule type, the
-- same way startDate/endDate already gate any rule type.
ALTER TABLE "PricingScheme" ADD COLUMN "flatDiscountPercent" REAL;
ALTER TABLE "PricingScheme" ADD COLUMN "startTimeMinutes" INTEGER;
ALTER TABLE "PricingScheme" ADD COLUMN "endTimeMinutes" INTEGER;
