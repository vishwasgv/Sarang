-- Phase 27: Salon, Gym/Studio, Driving School
-- Adds StaffCommission, MembershipPlan, Membership, MemberAttendance,
--          BatchClass, BatchClassAttendance, LearnerProfile, DrivingVehicle,
--          DrivingSession, DrivingTest

-- StaffCommission
CREATE TABLE "StaffCommission" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "staffId"          TEXT NOT NULL,
  "appointmentId"    TEXT,
  "serviceRevenue"   DECIMAL NOT NULL DEFAULT 0,
  "commissionType"   TEXT NOT NULL DEFAULT 'PERCENT',
  "commissionRate"   DECIMAL NOT NULL DEFAULT 0,
  "commissionAmount" DECIMAL NOT NULL DEFAULT 0,
  "tipAmount"        DECIMAL NOT NULL DEFAULT 0,
  "period"           TEXT NOT NULL,
  "isPaid"           BOOLEAN NOT NULL DEFAULT false,
  "paidDate"         DATETIME,
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffCommission_staffId_fkey"       FOREIGN KEY ("staffId")       REFERENCES "Employee"("id")    ON DELETE CASCADE   ON UPDATE CASCADE,
  CONSTRAINT "StaffCommission_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StaffCommission_appointmentId_key" ON "StaffCommission"("appointmentId");
CREATE INDEX "StaffCommission_staffId_idx"       ON "StaffCommission"("staffId");
CREATE INDEX "StaffCommission_period_idx"        ON "StaffCommission"("period");
CREATE INDEX "StaffCommission_isPaid_idx"        ON "StaffCommission"("isPaid");
CREATE INDEX "StaffCommission_appointmentId_idx" ON "StaffCommission"("appointmentId");

-- MembershipPlan
CREATE TABLE "MembershipPlan" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "planName"         TEXT NOT NULL,
  "durationDays"     INTEGER NOT NULL DEFAULT 30,
  "price"            DECIMAL NOT NULL DEFAULT 0,
  "sessionsIncluded" INTEGER,
  "allowedClasses"   TEXT,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        DATETIME NOT NULL
);

CREATE INDEX "MembershipPlan_isActive_idx" ON "MembershipPlan"("isActive");

-- Membership
CREATE TABLE "Membership" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "clientId"      TEXT NOT NULL,
  "planId"        TEXT NOT NULL,
  "startDate"     DATETIME NOT NULL,
  "endDate"       DATETIME NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
  "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "sessionsUsed"  INTEGER NOT NULL DEFAULT 0,
  "invoiceId"     TEXT,
  "freezeHistory" TEXT,
  "notes"         TEXT,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL,
  CONSTRAINT "Membership_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer"("id")      ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "Membership_planId_fkey"   FOREIGN KEY ("planId")   REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Membership_clientId_idx" ON "Membership"("clientId");
CREATE INDEX "Membership_status_idx"   ON "Membership"("status");
CREATE INDEX "Membership_endDate_idx"  ON "Membership"("endDate");

-- MemberAttendance
CREATE TABLE "MemberAttendance" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "clientId"     TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "checkInTime"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkOutTime" DATETIME,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberAttendance_clientId_fkey"     FOREIGN KEY ("clientId")     REFERENCES "Customer"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemberAttendance_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemberAttendance_clientId_idx"     ON "MemberAttendance"("clientId");
CREATE INDEX "MemberAttendance_membershipId_idx" ON "MemberAttendance"("membershipId");
CREATE INDEX "MemberAttendance_checkInTime_idx"  ON "MemberAttendance"("checkInTime");

-- BatchClass
CREATE TABLE "BatchClass" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "className"        TEXT NOT NULL,
  "instructorId"     TEXT,
  "maxCapacity"      INTEGER NOT NULL DEFAULT 20,
  "enrolledMemberIds" TEXT NOT NULL DEFAULT '[]',
  "scheduleDays"     TEXT NOT NULL DEFAULT '[]',
  "scheduleTime"     TEXT NOT NULL,
  "roomOrLocation"   TEXT,
  "startDate"        DATETIME NOT NULL,
  "endDate"          DATETIME,
  "status"           TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        DATETIME NOT NULL,
  CONSTRAINT "BatchClass_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "BatchClass_status_idx"      ON "BatchClass"("status");
CREATE INDEX "BatchClass_instructorId_idx" ON "BatchClass"("instructorId");

-- BatchClassAttendance
CREATE TABLE "BatchClassAttendance" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "classId"     TEXT NOT NULL,
  "memberId"    TEXT NOT NULL,
  "sessionDate" DATETIME NOT NULL,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BatchClassAttendance_classId_fkey"  FOREIGN KEY ("classId")  REFERENCES "BatchClass"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BatchClassAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Customer"("id")  ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BatchClassAttendance_classId_memberId_sessionDate_key" ON "BatchClassAttendance"("classId", "memberId", "sessionDate");
CREATE INDEX "BatchClassAttendance_classId_idx"  ON "BatchClassAttendance"("classId");
CREATE INDEX "BatchClassAttendance_sessionDate_idx" ON "BatchClassAttendance"("sessionDate");

-- LearnerProfile
CREATE TABLE "LearnerProfile" (
  "id"                     TEXT NOT NULL PRIMARY KEY,
  "customerId"             TEXT NOT NULL UNIQUE,
  "dlApplicationNumber"    TEXT,
  "learnerLicenseNumber"   TEXT,
  "learnerLicenseDate"     DATETIME,
  "permanentLicenseNumber" TEXT,
  "permanentLicenseDate"   DATETIME,
  "licenseClass"           TEXT NOT NULL DEFAULT 'LMV',
  "vehicleClassPreference" TEXT,
  "createdAt"              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              DATETIME NOT NULL,
  CONSTRAINT "LearnerProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LearnerProfile_customerId_idx" ON "LearnerProfile"("customerId");

-- DrivingVehicle
CREATE TABLE "DrivingVehicle" (
  "id"                 TEXT NOT NULL PRIMARY KEY,
  "registrationNumber" TEXT NOT NULL UNIQUE,
  "make"               TEXT NOT NULL,
  "model"              TEXT NOT NULL,
  "vehicleClass"       TEXT NOT NULL DEFAULT 'LMV',
  "instructorId"       TEXT,
  "status"             TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          DATETIME NOT NULL,
  CONSTRAINT "DrivingVehicle_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "DrivingVehicle_status_idx"      ON "DrivingVehicle"("status");
CREATE INDEX "DrivingVehicle_vehicleClass_idx" ON "DrivingVehicle"("vehicleClass");

-- DrivingSession
CREATE TABLE "DrivingSession" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "learnerId"       TEXT NOT NULL,
  "instructorId"    TEXT NOT NULL,
  "vehicleId"       TEXT NOT NULL,
  "sessionDate"     DATETIME NOT NULL,
  "sessionTime"     TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 60,
  "pickupPoint"     TEXT,
  "sessionNumber"   INTEGER NOT NULL DEFAULT 1,
  "status"          TEXT NOT NULL DEFAULT 'SCHEDULED',
  "instructorNotes" TEXT,
  "invoiceId"       TEXT,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       DATETIME NOT NULL,
  CONSTRAINT "DrivingSession_learnerId_fkey"    FOREIGN KEY ("learnerId")    REFERENCES "Customer"("id")       ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "DrivingSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Employee"("id")       ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DrivingSession_vehicleId_fkey"    FOREIGN KEY ("vehicleId")    REFERENCES "DrivingVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "DrivingSession_learnerId_idx"    ON "DrivingSession"("learnerId");
CREATE INDEX "DrivingSession_instructorId_idx" ON "DrivingSession"("instructorId");
CREATE INDEX "DrivingSession_sessionDate_idx"  ON "DrivingSession"("sessionDate");
CREATE INDEX "DrivingSession_status_idx"       ON "DrivingSession"("status");

-- DrivingTest
CREATE TABLE "DrivingTest" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "learnerId"  TEXT NOT NULL,
  "testType"   TEXT NOT NULL,
  "testDate"   DATETIME NOT NULL,
  "testCenter" TEXT NOT NULL,
  "result"     TEXT NOT NULL DEFAULT 'PENDING',
  "retestDate" DATETIME,
  "notes"      TEXT,
  "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  DATETIME NOT NULL,
  CONSTRAINT "DrivingTest_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DrivingTest_learnerId_idx" ON "DrivingTest"("learnerId");
CREATE INDEX "DrivingTest_testType_idx"  ON "DrivingTest"("testType");
CREATE INDEX "DrivingTest_result_idx"    ON "DrivingTest"("result");
