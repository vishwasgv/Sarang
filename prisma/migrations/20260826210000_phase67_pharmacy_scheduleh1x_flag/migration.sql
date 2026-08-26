-- Phase 67 §9.1 — Pharmacy item 1: Schedule H1/X Narcotic Register.
-- Single plain boolean column, no FK, so a direct ALTER TABLE ADD COLUMN
-- suffices (no RedefineTables needed).

ALTER TABLE "Product" ADD COLUMN "isScheduleH1X" BOOLEAN NOT NULL DEFAULT false;
