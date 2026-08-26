-- Phase 68 §9.1 — Car Service Center item 3: parts-used-vs-quoted variance.
-- An optional one-time estimate the advisor can set at intake, distinct from
-- partsTotal which keeps evolving as actual parts get used.

ALTER TABLE "CarJobCard" ADD COLUMN "quotedPartsTotal" DECIMAL;
