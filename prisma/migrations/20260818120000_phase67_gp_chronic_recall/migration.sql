-- Phase 67 §9.1 item 19 — GP Clinic chronic-condition recall (GREENFIELD)
-- Deliberately separate from RecallRecord (Phase 25, Dental): RecallRecord.patientId
-- is @unique (one hygiene cycle per patient), but a GP patient can carry several
-- independently-tracked chronic conditions at once. ChronicRecallComplianceLog
-- snapshots each recall period's outcome (met on time or not) at the moment it's
-- closed out by the next upsert, since RecallRecord-style overwrite-in-place has
-- no other way to answer "was the last recall actually met."

-- CreateTable
CREATE TABLE "ChronicConditionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "conditionName" TEXT NOT NULL,
    "diagnosedDate" DATETIME,
    "lastVisitDate" DATETIME NOT NULL,
    "nextRecallDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChronicConditionRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChronicConditionRecord_patientId_idx" ON "ChronicConditionRecord"("patientId");

-- CreateIndex
CREATE INDEX "ChronicConditionRecord_nextRecallDate_idx" ON "ChronicConditionRecord"("nextRecallDate");

-- CreateIndex
CREATE INDEX "ChronicConditionRecord_isActive_idx" ON "ChronicConditionRecord"("isActive");

-- CreateTable
CREATE TABLE "ChronicRecallComplianceLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "scheduledDate" DATETIME NOT NULL,
    "actualDate" DATETIME NOT NULL,
    "onTime" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChronicRecallComplianceLog_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ChronicConditionRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChronicRecallComplianceLog_recordId_idx" ON "ChronicRecallComplianceLog"("recordId");

-- CreateIndex
CREATE INDEX "ChronicRecallComplianceLog_scheduledDate_idx" ON "ChronicRecallComplianceLog"("scheduledDate");
