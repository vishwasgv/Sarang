-- Real, severe bug found+fixed 2026-07-15: schema.prisma had drifted from
-- the migration history in far more places than the single missing
-- NormalRangeReference table found earlier the same day. This SQL is
-- Prisma's OWN generated diff (`prisma migrate diff --from-migrations
-- ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma
-- --script`), not hand-written — the authoritative, tool-verified way to
-- close this gap rather than continuing to hand-audit table-by-table.
--
-- Confirmed live: BusinessProfile.clinicSpecialty specifically caused the
-- packaged app's Setup Wizard to fail on every single fresh install with
-- "The column `clinicSpecialty` does not exist in the current database" —
-- meaning literally no new user could have ever completed setup. The
-- VisitNote vitals columns are the other half of the same Phase 54B work
-- whose NormalRangeReference table was fixed in the prior migration
-- (20260715173500) — the whole feature was never migrated, not just its
-- reference-data table. The rest (CoachingFeeRecord.invoiceId,
-- GoodsReceiptNote.reversedAt, RetainerAgreement.lastInvoicedPeriod,
-- DrivingSession's missing packageEnrollmentId foreign-key constraint,
-- a missing FreightLedger index, and several implicit-vs-named unique
-- index differences) were found by the same diff, not separately reproduced
-- via a crash — flagged here so they don't surface as a mystery bug later.

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN "clinicSpecialty" TEXT;

-- AlterTable
ALTER TABLE "CoachingFeeRecord" ADD COLUMN "invoiceId" TEXT;

-- AlterTable
ALTER TABLE "GoodsReceiptNote" ADD COLUMN "reversedAt" DATETIME;

-- AlterTable
ALTER TABLE "RetainerAgreement" ADD COLUMN "lastInvoicedPeriod" TEXT;

-- AlterTable
ALTER TABLE "VisitNote" ADD COLUMN "bpDiastolic" INTEGER;
ALTER TABLE "VisitNote" ADD COLUMN "bpSystolic" INTEGER;
ALTER TABLE "VisitNote" ADD COLUMN "heightCm" REAL;
ALTER TABLE "VisitNote" ADD COLUMN "pulseRate" INTEGER;
ALTER TABLE "VisitNote" ADD COLUMN "temperatureF" REAL;
ALTER TABLE "VisitNote" ADD COLUMN "vitalsFlags" TEXT;
ALTER TABLE "VisitNote" ADD COLUMN "weightKg" REAL;

-- RedefineTables: DrivingSession.packageEnrollmentId already existed as a
-- plain column (confirmed via PRAGMA table_info against a real DB) but was
-- missing its foreign-key constraint to DrivingPackageEnrollment entirely
-- -- SQLite requires a full table rebuild to add a FK to an existing column.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DrivingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learnerId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "sessionDate" DATETIME NOT NULL,
    "sessionTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "pickupPoint" TEXT,
    "sessionNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "instructorNotes" TEXT,
    "invoiceId" TEXT,
    "sessionFee" DECIMAL,
    "packageEnrollmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrivingSession_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrivingSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DrivingSession_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "DrivingVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DrivingSession_packageEnrollmentId_fkey" FOREIGN KEY ("packageEnrollmentId") REFERENCES "DrivingPackageEnrollment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DrivingSession" ("createdAt", "durationMinutes", "id", "instructorId", "instructorNotes", "invoiceId", "learnerId", "packageEnrollmentId", "pickupPoint", "sessionDate", "sessionFee", "sessionNumber", "sessionTime", "status", "updatedAt", "vehicleId") SELECT "createdAt", "durationMinutes", "id", "instructorId", "instructorNotes", "invoiceId", "learnerId", "packageEnrollmentId", "pickupPoint", "sessionDate", "sessionFee", "sessionNumber", "sessionTime", "status", "updatedAt", "vehicleId" FROM "DrivingSession";
DROP TABLE "DrivingSession";
ALTER TABLE "new_DrivingSession" RENAME TO "DrivingSession";
CREATE INDEX "DrivingSession_learnerId_idx" ON "DrivingSession"("learnerId");
CREATE INDEX "DrivingSession_instructorId_idx" ON "DrivingSession"("instructorId");
CREATE INDEX "DrivingSession_sessionDate_idx" ON "DrivingSession"("sessionDate");
CREATE INDEX "DrivingSession_status_idx" ON "DrivingSession"("status");
CREATE INDEX "DrivingSession_packageEnrollmentId_idx" ON "DrivingSession"("packageEnrollmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FreightLedger_shipmentId_idx" ON "FreightLedger"("shipmentId");

-- Prisma's diff also proposed 6 RedefineIndex blocks (DROP the implicit
-- sqlite_autoindex_* SQLite creates for an inline UNIQUE constraint, then
-- CREATE an explicitly-named index in its place) for DeliveryTracker,
-- DrivingVehicle, LearnerProfile, StudentProfile, TokenQueue, and
-- VisitNote. Deliberately NOT applied: verified directly (replaying the
-- full migration history against a fresh in-memory DB) that SQLite refuses
-- every one of these DROP INDEX statements with "index associated with
-- UNIQUE or PRIMARY KEY constraint cannot be dropped" -- these are
-- backing an inline UNIQUE column constraint, which SQLite only lets you
-- remove via a full table rebuild. This is purely a Prisma-internal naming
-- mismatch (the constraint itself is already enforced correctly either
-- way, confirmed by checking each table's real index list) -- not a bug,
-- and attempting the rebuild is unjustified risk/complexity for a
-- cosmetic difference. Ignore this specific class of diff output if
-- `prisma migrate diff` is run again in the future.
