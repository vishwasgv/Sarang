-- Phase 68 §9.1 — Tailor/Boutique item 3: fitting-stage tracker. Stamped only
-- on a real status change, mirroring ServiceProject.stageUpdatedAt.

ALTER TABLE "TailoringOrder" ADD COLUMN "statusUpdatedAt" DATETIME;
