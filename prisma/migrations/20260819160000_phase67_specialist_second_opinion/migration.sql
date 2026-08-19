-- Phase 67 §9.1 item 20.2 — Specialist Clinic: second-opinion consultation flag
ALTER TABLE "VisitNote" ADD COLUMN "isSecondOpinion" BOOLEAN NOT NULL DEFAULT false;
