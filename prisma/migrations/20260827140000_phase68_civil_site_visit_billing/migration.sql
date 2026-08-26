-- Phase 68 §9.1 — Civil Engineer items 1/2: site-visit-to-invoice linkage
-- and visits billed vs. unbilled. Nullable, no default needed — every
-- pre-existing SiteVisit row simply has no billable amount/invoice until
-- one is explicitly set.

ALTER TABLE "SiteVisit" ADD COLUMN "billableAmount" DECIMAL;
ALTER TABLE "SiteVisit" ADD COLUMN "invoiceId" TEXT;
