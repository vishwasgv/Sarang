-- Phase 40: adds the one missing field needed to close two invoice-generation
-- stubs left deliberately incomplete by their original phases (ShootBooking's
-- invoiceId and EventBooking's invoiceId both existed with no billable-amount
-- field and no generation function). TimeEntry (has `amount`) and
-- ServiceProjectMilestone (has `milestoneAmount`) already had what they
-- needed and are not touched by this migration — only their service-layer
-- generation functions were missing, not schema.
--
-- All changes additive: nullable columns, no existing column renamed or dropped.

ALTER TABLE "ShootBooking" ADD COLUMN "finalAmount" DECIMAL;
ALTER TABLE "EventBooking" ADD COLUMN "finalAmount" DECIMAL;
