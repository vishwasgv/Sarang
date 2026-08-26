-- Phase 67 §9.1 — Repair items 1/4/5: structured intake checklist,
-- category taxonomy, and parts-quoted-vs-actual variance. Four plain
-- nullable columns, no FK involved, so a direct ALTER TABLE suffices
-- (no RedefineTables block needed, unlike Consultant's/Service's own
-- FK-bearing additions this session).

ALTER TABLE "JobCard" ADD COLUMN "conditionOnArrival" TEXT;
ALTER TABLE "JobCard" ADD COLUMN "accessoriesReceived" TEXT;
ALTER TABLE "JobCard" ADD COLUMN "category" TEXT;
ALTER TABLE "JobCard" ADD COLUMN "quotedPartsTotal" REAL;
