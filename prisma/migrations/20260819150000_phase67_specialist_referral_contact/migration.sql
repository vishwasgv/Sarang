-- Phase 67 §9.1 item 20.4 — Specialist Clinic: referral-loop closure.
-- Additive-only fields on the existing shared VisitNote model.

-- AlterTable
ALTER TABLE "VisitNote" ADD COLUMN "referredByPhone" TEXT;
ALTER TABLE "VisitNote" ADD COLUMN "referredByEmail" TEXT;
