-- Phase 67 §9.1 item 20.5 — Specialist Clinic: waitlist prioritization by referral urgency
ALTER TABLE "TokenQueue" ADD COLUMN "isUrgent" BOOLEAN NOT NULL DEFAULT false;
