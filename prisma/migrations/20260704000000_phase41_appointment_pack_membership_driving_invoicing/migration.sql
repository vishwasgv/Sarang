-- Phase 41: session pack, appointment, membership, driving school invoicing

ALTER TABLE "ClientSessionPack" ADD COLUMN "taxRate" REAL NOT NULL DEFAULT 18;
ALTER TABLE "ClientSessionPack" ADD COLUMN "sacCode" TEXT;
ALTER TABLE "ClientSessionPack" ADD COLUMN "invoiceId" TEXT;

ALTER TABLE "DrivingSession" ADD COLUMN "sessionFee" DECIMAL;
ALTER TABLE "DrivingSession" ADD COLUMN "packageEnrollmentId" TEXT;

CREATE TABLE "DrivingPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageName" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "price" DECIMAL NOT NULL,
    "vehicleClass" TEXT NOT NULL DEFAULT 'LMV',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "DrivingPackage_isActive_idx" ON "DrivingPackage"("isActive");

CREATE TABLE "DrivingPackageEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learnerId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
    "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrivingPackageEnrollment_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrivingPackageEnrollment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "DrivingPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "DrivingPackageEnrollment_learnerId_idx" ON "DrivingPackageEnrollment"("learnerId");

CREATE INDEX "DrivingSession_packageEnrollmentId_idx" ON "DrivingSession"("packageEnrollmentId");
