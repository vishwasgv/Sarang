-- Phase 26: Physiotherapy Clinic
-- Adds TreatmentPhase, ExerciseProgram, ClientSessionPack, SessionLog
-- Extends VisitNote with painScore + treatmentGiven

-- VisitNote physio fields
ALTER TABLE "VisitNote" ADD COLUMN "painScore" INTEGER;
ALTER TABLE "VisitNote" ADD COLUMN "treatmentGiven" TEXT;

-- TreatmentPhase
CREATE TABLE "TreatmentPhase" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "patientId"   TEXT NOT NULL,
  "phase"       TEXT NOT NULL DEFAULT 'ASSESSMENT',
  "title"       TEXT NOT NULL,
  "startDate"   DATETIME NOT NULL,
  "endDate"     DATETIME,
  "goals"       TEXT,
  "outcome"     TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL,
  CONSTRAINT "TreatmentPhase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TreatmentPhase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "TreatmentPhase_patientId_idx" ON "TreatmentPhase"("patientId");
CREATE INDEX "TreatmentPhase_isActive_idx" ON "TreatmentPhase"("isActive");

-- ExerciseProgram
CREATE TABLE "ExerciseProgram" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "patientId"   TEXT NOT NULL,
  "title"       TEXT NOT NULL DEFAULT 'Home Exercise Program',
  "exercises"   TEXT NOT NULL DEFAULT '[]',
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "printedAt"   DATETIME,
  "createdById" TEXT,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL,
  CONSTRAINT "ExerciseProgram_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExerciseProgram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ExerciseProgram_patientId_idx" ON "ExerciseProgram"("patientId");
CREATE INDEX "ExerciseProgram_isActive_idx" ON "ExerciseProgram"("isActive");

-- ClientSessionPack
CREATE TABLE "ClientSessionPack" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "customerId"    TEXT NOT NULL,
  "packName"      TEXT NOT NULL,
  "totalSessions" INTEGER NOT NULL,
  "usedSessions"  INTEGER NOT NULL DEFAULT 0,
  "purchaseDate"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiryDate"    DATETIME,
  "pricePerPack"  DECIMAL NOT NULL DEFAULT 0,
  "notes"         TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL,
  CONSTRAINT "ClientSessionPack_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ClientSessionPack_customerId_idx" ON "ClientSessionPack"("customerId");
CREATE INDEX "ClientSessionPack_isActive_idx" ON "ClientSessionPack"("isActive");
CREATE INDEX "ClientSessionPack_expiryDate_idx" ON "ClientSessionPack"("expiryDate");

-- SessionLog
CREATE TABLE "SessionLog" (
  "id"                  TEXT NOT NULL PRIMARY KEY,
  "clientSessionPackId" TEXT NOT NULL,
  "appointmentId"       TEXT,
  "deductedAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"               TEXT,
  CONSTRAINT "SessionLog_clientSessionPackId_fkey" FOREIGN KEY ("clientSessionPackId") REFERENCES "ClientSessionPack"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SessionLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SessionLog_appointmentId_key" ON "SessionLog"("appointmentId");
CREATE INDEX "SessionLog_clientSessionPackId_idx" ON "SessionLog"("clientSessionPackId");
