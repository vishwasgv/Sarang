-- CreateTable
CREATE TABLE "DrivingVehicleMaintenanceLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "serviceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odometerKm" INTEGER NOT NULL,
    "serviceType" TEXT NOT NULL,
    "cost" DECIMAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrivingVehicleMaintenanceLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "DrivingVehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DrivingTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learnerId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "testDate" DATETIME NOT NULL,
    "testCenter" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "retestDate" DATETIME,
    "notes" TEXT,
    "instructorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrivingTest_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrivingTest_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DrivingTest" ("createdAt", "id", "learnerId", "notes", "result", "retestDate", "testCenter", "testDate", "testType", "updatedAt") SELECT "createdAt", "id", "learnerId", "notes", "result", "retestDate", "testCenter", "testDate", "testType", "updatedAt" FROM "DrivingTest";
DROP TABLE "DrivingTest";
ALTER TABLE "new_DrivingTest" RENAME TO "DrivingTest";
CREATE INDEX "DrivingTest_learnerId_idx" ON "DrivingTest"("learnerId");
CREATE INDEX "DrivingTest_instructorId_idx" ON "DrivingTest"("instructorId");
CREATE INDEX "DrivingTest_testType_idx" ON "DrivingTest"("testType");
CREATE INDEX "DrivingTest_result_idx" ON "DrivingTest"("result");
CREATE TABLE "new_DrivingVehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registrationNumber" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vehicleClass" TEXT NOT NULL DEFAULT 'LMV',
    "instructorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "odometerKm" INTEGER NOT NULL DEFAULT 0,
    "serviceIntervalKm" INTEGER NOT NULL DEFAULT 5000,
    "serviceIntervalSessions" INTEGER NOT NULL DEFAULT 30,
    "lastServiceOdometerKm" INTEGER NOT NULL DEFAULT 0,
    "lastServiceDate" DATETIME,
    "sessionsSinceService" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrivingVehicle_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DrivingVehicle" ("createdAt", "id", "instructorId", "make", "model", "registrationNumber", "status", "updatedAt", "vehicleClass") SELECT "createdAt", "id", "instructorId", "make", "model", "registrationNumber", "status", "updatedAt", "vehicleClass" FROM "DrivingVehicle";
DROP TABLE "DrivingVehicle";
ALTER TABLE "new_DrivingVehicle" RENAME TO "DrivingVehicle";
CREATE UNIQUE INDEX "DrivingVehicle_registrationNumber_key" ON "DrivingVehicle"("registrationNumber");
CREATE INDEX "DrivingVehicle_status_idx" ON "DrivingVehicle"("status");
CREATE INDEX "DrivingVehicle_vehicleClass_idx" ON "DrivingVehicle"("vehicleClass");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DrivingVehicleMaintenanceLog_vehicleId_idx" ON "DrivingVehicleMaintenanceLog"("vehicleId");

-- CreateIndex
CREATE INDEX "DrivingVehicleMaintenanceLog_serviceDate_idx" ON "DrivingVehicleMaintenanceLog"("serviceDate");
