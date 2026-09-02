-- 2026-09 §12 — Tours & Travels vertical: fleet, tour packages/departures,
-- trip bookings (charter + seat), driver duty settlement, vehicle service log.
--
-- Named TourVehicle, not Vehicle — a plain "Vehicle" table already exists
-- (Phase 37 Logistics & Supply Chain's own delivery fleet), a genuinely
-- different concept that happened to want the same name. Caught by a real
-- `table "Vehicle" already exists` migration failure during this build —
-- this file was rewritten before that first, failed attempt ever created
-- anything (CREATE TABLE "Vehicle" was this file's first statement).

CREATE TABLE "TourVehicle" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "registrationNumber" TEXT NOT NULL,
    "vehicleType"        TEXT NOT NULL,
    "seatingCapacity"    INTEGER NOT NULL,
    "currentOdometer"    REAL NOT NULL DEFAULT 0,
    "status"             TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes"              TEXT,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          DATETIME NOT NULL
);
CREATE UNIQUE INDEX "TourVehicle_registrationNumber_key" ON "TourVehicle"("registrationNumber");
CREATE INDEX "TourVehicle_status_idx" ON "TourVehicle"("status");

CREATE TABLE "TourPackage" (
    "id"                   TEXT NOT NULL PRIMARY KEY,
    "packageName"          TEXT NOT NULL,
    "itineraryDescription" TEXT,
    "durationDays"         INTEGER NOT NULL,
    "defaultTotalSeats"    INTEGER NOT NULL,
    "farePerSeat"          REAL NOT NULL,
    "isActive"             BOOLEAN NOT NULL DEFAULT true,
    "createdAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "TourPackage_isActive_idx" ON "TourPackage"("isActive");

CREATE TABLE "TourDeparture" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "tourPackageId" TEXT NOT NULL,
    "departureDate" DATETIME NOT NULL,
    "vehicleId"     TEXT,
    "totalSeats"    INTEGER NOT NULL,
    "seatsBooked"   INTEGER NOT NULL DEFAULT 0,
    "status"        TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TourDeparture_tourPackageId_fkey" FOREIGN KEY ("tourPackageId") REFERENCES "TourPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TourDeparture_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TourVehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TourDeparture_tourPackageId_idx" ON "TourDeparture"("tourPackageId");
CREATE INDEX "TourDeparture_departureDate_idx" ON "TourDeparture"("departureDate");
CREATE INDEX "TourDeparture_status_idx" ON "TourDeparture"("status");

CREATE TABLE "TripBooking" (
    "id"                    TEXT NOT NULL PRIMARY KEY,
    "bookingNumber"         TEXT NOT NULL,
    "bookingType"           TEXT NOT NULL,
    "customerId"            TEXT NOT NULL,
    "vehicleId"             TEXT,
    "tourDepartureId"       TEXT,
    "seatsBooked"           INTEGER,
    "tripStartDate"         DATETIME NOT NULL,
    "tripEndDate"           DATETIME,
    "pickupLocation"        TEXT,
    "dropLocation"          TEXT,
    "route"                 TEXT,
    "packageRate"           REAL NOT NULL,
    "includedKmPerDay"      REAL,
    "includedHoursPerDay"   REAL,
    "advanceAmount"         REAL NOT NULL DEFAULT 0,
    "advancePaymentMethod"  TEXT NOT NULL DEFAULT 'CASH',
    "referringAgentName"    TEXT,
    "commissionType"        TEXT,
    "commissionValue"       REAL,
    "status"                TEXT NOT NULL DEFAULT 'BOOKED',
    "invoiceId"             TEXT,
    "notes"                 TEXT,
    "createdById"           TEXT,
    "createdAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             DATETIME NOT NULL,
    CONSTRAINT "TripBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TripBooking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TourVehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TripBooking_tourDepartureId_fkey" FOREIGN KEY ("tourDepartureId") REFERENCES "TourDeparture" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TripBooking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TripBooking_bookingNumber_key" ON "TripBooking"("bookingNumber");
CREATE INDEX "TripBooking_customerId_idx" ON "TripBooking"("customerId");
CREATE INDEX "TripBooking_vehicleId_idx" ON "TripBooking"("vehicleId");
CREATE INDEX "TripBooking_tourDepartureId_idx" ON "TripBooking"("tourDepartureId");
CREATE INDEX "TripBooking_status_idx" ON "TripBooking"("status");
CREATE INDEX "TripBooking_tripStartDate_idx" ON "TripBooking"("tripStartDate");

CREATE TABLE "DriverDutyLog" (
    "id"                    TEXT NOT NULL PRIMARY KEY,
    "tripBookingId"         TEXT NOT NULL,
    "driverId"              TEXT NOT NULL,
    "dutyDate"              DATETIME NOT NULL,
    "startOdometer"         REAL NOT NULL,
    "endOdometer"           REAL,
    "dutyStartTime"         DATETIME NOT NULL,
    "dutyEndTime"           DATETIME,
    "driverBataAmount"      REAL NOT NULL DEFAULT 0,
    "nightHaltCharge"       REAL NOT NULL DEFAULT 0,
    "nightDrivingAllowance" REAL NOT NULL DEFAULT 0,
    "kmDriven"              REAL,
    "drivingHours"          REAL,
    "excessKm"              REAL,
    "excessKmCharge"        REAL,
    "excessHours"           REAL,
    "excessHourCharge"      REAL,
    "notes"                 TEXT,
    "createdAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriverDutyLog_tripBookingId_fkey" FOREIGN KEY ("tripBookingId") REFERENCES "TripBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DriverDutyLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DriverDutyLog_tripBookingId_idx" ON "DriverDutyLog"("tripBookingId");
CREATE INDEX "DriverDutyLog_driverId_idx" ON "DriverDutyLog"("driverId");
CREATE INDEX "DriverDutyLog_dutyDate_idx" ON "DriverDutyLog"("dutyDate");

CREATE TABLE "VehicleServiceLog" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "vehicleId"          TEXT NOT NULL,
    "serviceDate"        DATETIME NOT NULL,
    "serviceType"        TEXT NOT NULL,
    "odometerAtService"  REAL NOT NULL,
    "cost"               REAL NOT NULL DEFAULT 0,
    "nextServiceDueKm"   REAL,
    "nextServiceDueDate" DATETIME,
    "vendorName"         TEXT,
    "notes"              TEXT,
    "createdById"        TEXT,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleServiceLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TourVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VehicleServiceLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "VehicleServiceLog_vehicleId_idx" ON "VehicleServiceLog"("vehicleId");
CREATE INDEX "VehicleServiceLog_serviceDate_idx" ON "VehicleServiceLog"("serviceDate");
