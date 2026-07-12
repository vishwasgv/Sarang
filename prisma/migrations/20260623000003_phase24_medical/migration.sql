-- Phase 24 — Medical: VisitNote (SOAP) + TokenQueue (GP token queue)
-- Safe additive migration: no existing tables dropped or altered destructively

-- VisitNote: 1:1 with Appointment — SOAP consultation record
CREATE TABLE "VisitNote" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "appointmentId"  TEXT NOT NULL UNIQUE,
    "patientName"    TEXT NOT NULL,
    "patientAge"     TEXT,
    "chiefComplaint" TEXT,
    "subjective"     TEXT,
    "objective"      TEXT,
    "assessment"     TEXT,
    "plan"           TEXT,
    "followUpDate"   DATETIME,
    "followUpNotes"  TEXT,
    "referredBy"     TEXT,
    "referralDate"   DATETIME,
    "referralReason" TEXT,
    "isFinalized"    BOOLEAN NOT NULL DEFAULT 0,
    "finalizedAt"    DATETIME,
    "createdBy"      TEXT NOT NULL,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      DATETIME NOT NULL,
    CONSTRAINT "VisitNote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "VisitNote_createdBy_idx"   ON "VisitNote"("createdBy");
CREATE INDEX "VisitNote_isFinalized_idx" ON "VisitNote"("isFinalized");
CREATE INDEX "VisitNote_createdAt_idx"   ON "VisitNote"("createdAt");

-- TokenQueue: per-day token system for GP_CLINIC
CREATE TABLE "TokenQueue" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "queueDate"     DATETIME NOT NULL,
    "tokenNumber"   INTEGER NOT NULL,
    "patientName"   TEXT NOT NULL,
    "age"           TEXT,
    "gender"        TEXT,
    "phone"         TEXT,
    "appointmentId" TEXT UNIQUE,
    "status"        TEXT NOT NULL DEFAULT 'WAITING',
    "calledAt"      DATETIME,
    "seenAt"        DATETIME,
    "notes"         TEXT,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenQueue_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TokenQueue_queueDate_tokenNumber_key" ON "TokenQueue"("queueDate", "tokenNumber");
CREATE INDEX "TokenQueue_queueDate_status_idx"             ON "TokenQueue"("queueDate", "status");
CREATE INDEX "TokenQueue_appointmentId_idx"                ON "TokenQueue"("appointmentId");
