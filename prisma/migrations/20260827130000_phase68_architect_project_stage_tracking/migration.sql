-- Phase 68 §9.1 — Architect/Civil item 4: project stage progress. Nullable,
-- no default needed — only set by the dedicated stage-change path in
-- updateServiceProject going forward; pre-existing rows simply have no
-- tracked stage-entry time until their stage is next changed.

ALTER TABLE "ServiceProject" ADD COLUMN "stageUpdatedAt" DATETIME;
