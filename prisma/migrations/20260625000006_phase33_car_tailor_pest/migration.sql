-- Phase 33 — Car Service Center, Tailor Boutique, Pest Control
-- Creates: CarJobCard, MeasurementRecord, TailoringOrder, PestServiceContract, PestJobSheet

-- ── Car Job Card ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CarJobCard" (
  "id"                TEXT    NOT NULL PRIMARY KEY,
  "jobNumber"         TEXT    NOT NULL,
  "clientId"          TEXT    NOT NULL,
  "vehicleNumber"     TEXT    NOT NULL,
  "vehicleMake"       TEXT    NOT NULL,
  "vehicleModel"      TEXT    NOT NULL,
  "vehicleYear"       INTEGER,
  "vehicleType"       TEXT    NOT NULL DEFAULT '4W',
  "kmIn"              INTEGER,
  "kmOut"             INTEGER,
  "serviceAdvisorId"  TEXT,
  "technicianIds"     TEXT    NOT NULL DEFAULT '[]',
  "serviceItems"      TEXT    NOT NULL DEFAULT '[]',
  "partsItems"        TEXT    NOT NULL DEFAULT '[]',
  "laborTotal"        DECIMAL NOT NULL DEFAULT 0,
  "partsTotal"        DECIMAL NOT NULL DEFAULT 0,
  "estimatedDelivery" DATETIME,
  "deliveredDate"     DATETIME,
  "status"            TEXT    NOT NULL DEFAULT 'RECEIVED',
  "invoiceId"         TEXT,
  "notes"             TEXT,
  "internalNotes"     TEXT,
  "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         DATETIME NOT NULL,
  CONSTRAINT "CarJobCard_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE,
  CONSTRAINT "CarJobCard_serviceAdvisorId_fkey"
    FOREIGN KEY ("serviceAdvisorId") REFERENCES "Employee" ("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "CarJobCard_jobNumber_key" ON "CarJobCard"("jobNumber");
CREATE INDEX IF NOT EXISTS "CarJobCard_clientId_idx"      ON "CarJobCard"("clientId");
CREATE INDEX IF NOT EXISTS "CarJobCard_status_idx"        ON "CarJobCard"("status");
CREATE INDEX IF NOT EXISTS "CarJobCard_vehicleNumber_idx" ON "CarJobCard"("vehicleNumber");
CREATE INDEX IF NOT EXISTS "CarJobCard_createdAt_idx"     ON "CarJobCard"("createdAt");

-- ── Measurement Record ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MeasurementRecord" (
  "id"         TEXT    NOT NULL PRIMARY KEY,
  "clientId"   TEXT    NOT NULL,
  "chest"      DECIMAL,
  "waist"      DECIMAL,
  "hips"       DECIMAL,
  "shoulder"   DECIMAL,
  "neck"       DECIMAL,
  "sleeve"     DECIMAL,
  "inseam"     DECIMAL,
  "outseam"    DECIMAL,
  "thigh"      DECIMAL,
  "height"     DECIMAL,
  "notes"      TEXT,
  "takenById"  TEXT,
  "recordDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  DATETIME NOT NULL,
  CONSTRAINT "MeasurementRecord_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE,
  CONSTRAINT "MeasurementRecord_takenById_fkey"
    FOREIGN KEY ("takenById") REFERENCES "Employee" ("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "MeasurementRecord_clientId_idx"   ON "MeasurementRecord"("clientId");
CREATE INDEX IF NOT EXISTS "MeasurementRecord_recordDate_idx" ON "MeasurementRecord"("recordDate");

-- ── Tailoring Order ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TailoringOrder" (
  "id"                  TEXT    NOT NULL PRIMARY KEY,
  "orderNumber"         TEXT    NOT NULL,
  "clientId"            TEXT    NOT NULL,
  "measurementRecordId" TEXT,
  "garmentType"         TEXT    NOT NULL,
  "fabricDescription"   TEXT,
  "fabricSupplied"      TEXT    NOT NULL DEFAULT 'CLIENT',
  "quantity"            INTEGER NOT NULL DEFAULT 1,
  "unitPrice"           DECIMAL NOT NULL DEFAULT 0,
  "totalAmount"         DECIMAL NOT NULL DEFAULT 0,
  "advancePaid"         DECIMAL NOT NULL DEFAULT 0,
  "trialDate"           DATETIME,
  "deliveryDate"        DATETIME,
  "deliveredDate"       DATETIME,
  "status"              TEXT    NOT NULL DEFAULT 'RECEIVED',
  "assignedToId"        TEXT,
  "invoiceId"           TEXT,
  "specialInstructions" TEXT,
  "notes"               TEXT,
  "createdAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           DATETIME NOT NULL,
  CONSTRAINT "TailoringOrder_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE,
  CONSTRAINT "TailoringOrder_measurementRecordId_fkey"
    FOREIGN KEY ("measurementRecordId") REFERENCES "MeasurementRecord" ("id") ON DELETE SET NULL,
  CONSTRAINT "TailoringOrder_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "Employee" ("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "TailoringOrder_orderNumber_key"  ON "TailoringOrder"("orderNumber");
CREATE INDEX IF NOT EXISTS "TailoringOrder_clientId_idx"    ON "TailoringOrder"("clientId");
CREATE INDEX IF NOT EXISTS "TailoringOrder_status_idx"      ON "TailoringOrder"("status");
CREATE INDEX IF NOT EXISTS "TailoringOrder_deliveryDate_idx" ON "TailoringOrder"("deliveryDate");
CREATE INDEX IF NOT EXISTS "TailoringOrder_createdAt_idx"   ON "TailoringOrder"("createdAt");

-- ── Pest Service Contract ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PestServiceContract" (
  "id"               TEXT    NOT NULL PRIMARY KEY,
  "contractNumber"   TEXT    NOT NULL,
  "clientId"         TEXT    NOT NULL,
  "propertyAddress"  TEXT    NOT NULL,
  "propertyType"     TEXT    NOT NULL DEFAULT 'RESIDENTIAL',
  "pestTypes"        TEXT    NOT NULL DEFAULT '[]',
  "serviceFrequency" TEXT    NOT NULL DEFAULT 'QUARTERLY',
  "startDate"        DATETIME NOT NULL,
  "endDate"          DATETIME,
  "contractValue"    DECIMAL  NOT NULL,
  "status"           TEXT    NOT NULL DEFAULT 'ACTIVE',
  "assignedToId"     TEXT,
  "notes"            TEXT,
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        DATETIME NOT NULL,
  CONSTRAINT "PestServiceContract_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE,
  CONSTRAINT "PestServiceContract_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "Employee" ("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "PestServiceContract_contractNumber_key" ON "PestServiceContract"("contractNumber");
CREATE INDEX IF NOT EXISTS "PestServiceContract_clientId_idx"   ON "PestServiceContract"("clientId");
CREATE INDEX IF NOT EXISTS "PestServiceContract_status_idx"     ON "PestServiceContract"("status");
CREATE INDEX IF NOT EXISTS "PestServiceContract_assignedToId_idx" ON "PestServiceContract"("assignedToId");

-- ── Pest Job Sheet ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PestJobSheet" (
  "id"              TEXT    NOT NULL PRIMARY KEY,
  "jobNumber"       TEXT    NOT NULL,
  "contractId"      TEXT,
  "clientId"        TEXT    NOT NULL,
  "visitDate"       DATETIME NOT NULL,
  "scheduledTime"   TEXT,
  "technicianIds"   TEXT    NOT NULL DEFAULT '[]',
  "pesticideUsed"   TEXT,
  "areasServiced"   TEXT    NOT NULL DEFAULT '[]',
  "treatmentType"   TEXT    NOT NULL DEFAULT 'SPRAY',
  "jobAmount"       DECIMAL  NOT NULL DEFAULT 0,
  "status"          TEXT    NOT NULL DEFAULT 'SCHEDULED',
  "completedDate"   DATETIME,
  "followUpDate"    DATETIME,
  "clientSignature" BOOLEAN  NOT NULL DEFAULT false,
  "invoiceId"       TEXT,
  "notes"           TEXT,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       DATETIME NOT NULL,
  CONSTRAINT "PestJobSheet_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "PestServiceContract" ("id") ON DELETE SET NULL,
  CONSTRAINT "PestJobSheet_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PestJobSheet_jobNumber_key"  ON "PestJobSheet"("jobNumber");
CREATE INDEX IF NOT EXISTS "PestJobSheet_contractId_idx"  ON "PestJobSheet"("contractId");
CREATE INDEX IF NOT EXISTS "PestJobSheet_clientId_idx"    ON "PestJobSheet"("clientId");
CREATE INDEX IF NOT EXISTS "PestJobSheet_status_idx"      ON "PestJobSheet"("status");
CREATE INDEX IF NOT EXISTS "PestJobSheet_visitDate_idx"   ON "PestJobSheet"("visitDate");
