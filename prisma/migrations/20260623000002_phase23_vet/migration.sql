-- Phase 23: Veterinary — Pet, WeightHistory, VaccinationRecord
-- SQLite: ADD COLUMN is always nullable (safe for existing rows)

-- Add petId to Appointment
ALTER TABLE "Appointment" ADD COLUMN "petId" TEXT;

-- Create Pet table
CREATE TABLE "Pet" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "customerId"  TEXT,
    "petName"     TEXT NOT NULL,
    "species"     TEXT NOT NULL DEFAULT 'Dog',
    "breed"       TEXT,
    "dateOfBirth" DATETIME,
    "gender"      TEXT,
    "color"       TEXT,
    "weight"      REAL,
    "microchipId" TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT 1,
    "notes"       TEXT,
    "photoPath"   TEXT,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pet_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create WeightHistory table
CREATE TABLE "WeightHistory" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "petId"      TEXT NOT NULL,
    "weightKg"   REAL NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"      TEXT,
    CONSTRAINT "WeightHistory_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create VaccinationRecord table
CREATE TABLE "VaccinationRecord" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "petId"              TEXT NOT NULL,
    "vaccineName"        TEXT NOT NULL,
    "vaccineType"        TEXT,
    "batchNumber"        TEXT,
    "manufacturer"       TEXT,
    "administeredAt"     DATETIME NOT NULL,
    "administeredBy"     TEXT,
    "nextDueDate"        DATETIME,
    "notes"              TEXT,
    "certificatePrinted" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VaccinationRecord_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "Pet_customerId_idx"             ON "Pet"("customerId");
CREATE INDEX "Pet_species_idx"                ON "Pet"("species");
CREATE INDEX "Pet_isActive_idx"               ON "Pet"("isActive");
CREATE INDEX "WeightHistory_petId_idx"        ON "WeightHistory"("petId");
CREATE INDEX "WeightHistory_recordedAt_idx"   ON "WeightHistory"("recordedAt");
CREATE INDEX "VaccinationRecord_petId_idx"    ON "VaccinationRecord"("petId");
CREATE INDEX "VaccinationRecord_nextDueDate_idx" ON "VaccinationRecord"("nextDueDate");
CREATE INDEX "Appointment_petId_idx"          ON "Appointment"("petId");
