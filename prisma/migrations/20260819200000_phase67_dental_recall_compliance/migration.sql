-- Phase 67 §9.1 item 21.4 — Dental Clinic Recall Compliance report. Same
-- shape as ChronicRecallComplianceLog (GP Clinic), deliberately separate:
-- RecallRecord.patientId is @unique (one hygiene cycle per patient), a
-- structurally different source table from ChronicConditionRecord's
-- several-per-patient design.

-- CreateTable
CREATE TABLE "RecallComplianceLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "scheduledDate" DATETIME NOT NULL,
    "actualDate" DATETIME NOT NULL,
    "onTime" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecallComplianceLog_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "RecallRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecallComplianceLog_recordId_idx" ON "RecallComplianceLog"("recordId");

-- CreateIndex
CREATE INDEX "RecallComplianceLog_scheduledDate_idx" ON "RecallComplianceLog"("scheduledDate");
