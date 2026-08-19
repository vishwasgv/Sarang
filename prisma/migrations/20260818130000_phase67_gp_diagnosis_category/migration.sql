-- Phase 67 §9.1 item 19.4 — GP Clinic: diagnosis-category trend report.
-- Additive-only field on the existing shared VisitNote model, so all 4
-- visit_notes-sharing clinical verticals get the column but only GP_CLINIC
-- surfaces it (new `diagnosis_categories` module gate, UI/report layer).

-- AlterTable
ALTER TABLE "VisitNote" ADD COLUMN "diagnosisCategory" TEXT;
