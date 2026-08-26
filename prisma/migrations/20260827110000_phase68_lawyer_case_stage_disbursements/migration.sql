-- Phase 68 §9.1 — Lawyer item 3: case-stage tracker; item 5: court-fee/
-- disbursement tracking. SQLite ALTER TABLE ADD COLUMN does not reliably
-- support CURRENT_TIMESTAMP as a default in all versions, so
-- caseStageUpdatedAt backfills existing rows to a fixed literal instant
-- (this migration's own apply time) rather than relying on that -- new rows
-- get the real current time via Prisma's own @default(now()) at the
-- application layer, this literal only matters for pre-existing rows.

ALTER TABLE "LegalCase" ADD COLUMN "caseStage" TEXT NOT NULL DEFAULT 'FILING';
ALTER TABLE "LegalCase" ADD COLUMN "caseStageUpdatedAt" DATETIME NOT NULL DEFAULT '2026-08-27 00:00:00';

CREATE TABLE "CaseDisbursement" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "caseId"           TEXT NOT NULL,
    "description"      TEXT NOT NULL,
    "amount"           DECIMAL NOT NULL,
    "paidDate"         DATETIME NOT NULL,
    "isBilledToClient" BOOLEAN NOT NULL DEFAULT false,
    "notes"            TEXT,
    "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseDisbursement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CaseDisbursement_caseId_idx" ON "CaseDisbursement"("caseId");
