-- Phase 58 §2 — Dental Clinic: append-only per-tooth chronological history
CREATE TABLE "ToothRecordHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toothRecordId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "surface" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "recordedDate" DATETIME NOT NULL,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ToothRecordHistory_toothRecordId_fkey" FOREIGN KEY ("toothRecordId") REFERENCES "ToothRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ToothRecordHistory_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ToothRecordHistory_toothRecordId_idx" ON "ToothRecordHistory"("toothRecordId");
