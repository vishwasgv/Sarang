-- Phase 58 §2 — Blood Bank: emergency-release override reason + component/sex-aware cooldown
ALTER TABLE "BloodIssueItem" ADD COLUMN "overrideReason" TEXT;
ALTER TABLE "Donor" ADD COLUMN "lastDonationComponentType" TEXT;
