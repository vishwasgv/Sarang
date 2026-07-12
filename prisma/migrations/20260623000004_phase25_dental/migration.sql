-- Phase 25 — Dental Clinic: ToothRecord, TreatmentPlan, RecallRecord
-- Also extends Appointment (chairAssignment) and VisitNote (treatmentDone)

-- Extend Appointment with dental chair assignment
ALTER TABLE "Appointment" ADD COLUMN "chairAssignment" TEXT;

-- Extend VisitNote with dental treatment done field
ALTER TABLE "VisitNote" ADD COLUMN "treatmentDone" TEXT;

-- Create ToothRecord table (one row per patient+tooth, upsert pattern)
CREATE TABLE "ToothRecord" (
    "id"           TEXT     NOT NULL PRIMARY KEY,
    "patientId"    TEXT     NOT NULL,
    "toothNumber"  INTEGER  NOT NULL,
    "surface"      TEXT     NOT NULL DEFAULT '[]',
    "condition"    TEXT     NOT NULL DEFAULT 'SOUND',
    "notes"        TEXT,
    "recordedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "updatedAt"    DATETIME NOT NULL,
    CONSTRAINT "ToothRecord_patientId_fkey"    FOREIGN KEY ("patientId")    REFERENCES "Customer" ("id") ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "ToothRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create TreatmentPlan table
CREATE TABLE "TreatmentPlan" (
    "id"                 TEXT     NOT NULL PRIMARY KEY,
    "patientId"          TEXT     NOT NULL,
    "createdById"        TEXT,
    "title"              TEXT     NOT NULL DEFAULT 'Treatment Plan',
    "status"             TEXT     NOT NULL DEFAULT 'PROPOSED',
    "planItems"          TEXT     NOT NULL DEFAULT '[]',
    "totalEstimatedCost" DECIMAL  NOT NULL DEFAULT 0,
    "notes"              TEXT,
    "acceptedDate"       DATETIME,
    "completedDate"      DATETIME,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          DATETIME NOT NULL,
    CONSTRAINT "TreatmentPlan_patientId_fkey"   FOREIGN KEY ("patientId")   REFERENCES "Customer" ("id") ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "TreatmentPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create RecallRecord table (one per patient via @unique)
CREATE TABLE "RecallRecord" (
    "id"               TEXT     NOT NULL PRIMARY KEY,
    "patientId"        TEXT     NOT NULL,
    "recallType"       TEXT     NOT NULL DEFAULT 'HYGIENE_6M',
    "lastVisitDate"    DATETIME NOT NULL,
    "nextRecallDate"   DATETIME NOT NULL,
    "reminderSent"     BOOLEAN  NOT NULL DEFAULT 0,
    "reminderSentDate" DATETIME,
    "notes"            TEXT,
    "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        DATETIME NOT NULL,
    CONSTRAINT "RecallRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraints
CREATE UNIQUE INDEX "ToothRecord_patientId_toothNumber_key" ON "ToothRecord"("patientId", "toothNumber");
CREATE UNIQUE INDEX "RecallRecord_patientId_key"            ON "RecallRecord"("patientId");

-- Performance indexes
CREATE INDEX "ToothRecord_patientId_idx"    ON "ToothRecord"("patientId");
CREATE INDEX "ToothRecord_condition_idx"    ON "ToothRecord"("condition");
CREATE INDEX "TreatmentPlan_patientId_idx"  ON "TreatmentPlan"("patientId");
CREATE INDEX "TreatmentPlan_status_idx"     ON "TreatmentPlan"("status");
CREATE INDEX "TreatmentPlan_createdAt_idx"  ON "TreatmentPlan"("createdAt");
CREATE INDEX "RecallRecord_nextRecallDate_idx" ON "RecallRecord"("nextRecallDate");
