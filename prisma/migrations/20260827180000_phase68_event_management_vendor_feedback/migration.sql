-- Phase 68 §9.1 — Event Management item 5: post-event feedback linked to
-- vendor history. Lives on EventVendorBooking directly so a vendor's
-- performance is queryable across every event they've worked.

ALTER TABLE "EventVendorBooking" ADD COLUMN "vendorRating" INTEGER;
ALTER TABLE "EventVendorBooking" ADD COLUMN "vendorFeedback" TEXT;
