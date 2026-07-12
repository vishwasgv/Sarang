-- Phase 22: Service Business Foundation
-- SQLite migration — ALTER TABLE ADD COLUMN + CREATE TABLE

-- BusinessProfile: 3 new columns (service business identity)
ALTER TABLE "BusinessProfile" ADD COLUMN "businessCategory"    TEXT NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE "BusinessProfile" ADD COLUMN "serviceTemplateType" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "languageLock"        TEXT NOT NULL DEFAULT 'multi';

-- Employee: 6 new nullable columns (provider extensions)
ALTER TABLE "Employee" ADD COLUMN "commissionRate"          REAL;
ALTER TABLE "Employee" ADD COLUMN "hourlyBillingRate"       REAL;
ALTER TABLE "Employee" ADD COLUMN "specialization"          TEXT;
ALTER TABLE "Employee" ADD COLUMN "providerCalendarEnabled" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Employee" ADD COLUMN "providerColor"           TEXT;
ALTER TABLE "Employee" ADD COLUMN "maxAppointmentsPerDay"   INTEGER;

-- ServiceCatalog: template-aware service menu
CREATE TABLE "ServiceCatalog" (
    "id"              TEXT     NOT NULL PRIMARY KEY,
    "serviceName"     TEXT     NOT NULL,
    "serviceCode"     TEXT,
    "category"        TEXT,
    "description"     TEXT,
    "durationMinutes" INTEGER  NOT NULL DEFAULT 30,
    "basePrice"       REAL     NOT NULL DEFAULT 0,
    "taxRate"         REAL     NOT NULL DEFAULT 0,
    "sacCode"         TEXT,
    "isActive"        BOOLEAN  NOT NULL DEFAULT 1,
    "notes"           TEXT,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ServiceCatalog_serviceCode_key" ON "ServiceCatalog"("serviceCode");
CREATE INDEX "ServiceCatalog_isActive_idx"    ON "ServiceCatalog"("isActive");
CREATE INDEX "ServiceCatalog_category_idx"    ON "ServiceCatalog"("category");
CREATE INDEX "ServiceCatalog_serviceName_idx" ON "ServiceCatalog"("serviceName");

-- Appointment: core booking entity
CREATE TABLE "Appointment" (
    "id"                 TEXT     NOT NULL PRIMARY KEY,
    "appointmentNumber"  TEXT     NOT NULL,
    "customerId"         TEXT,
    "customerName"       TEXT,
    "providerId"         TEXT,
    "serviceCatalogId"   TEXT,
    "serviceTitle"       TEXT     NOT NULL,
    "scheduledDate"      DATETIME NOT NULL,
    "scheduledTime"      TEXT     NOT NULL,
    "durationMinutes"    INTEGER  NOT NULL DEFAULT 30,
    "status"             TEXT     NOT NULL DEFAULT 'SCHEDULED',
    "notes"              TEXT,
    "privateNotes"       TEXT,
    "cancellationReason" TEXT,
    "invoiceId"          TEXT,
    "totalAmount"        REAL     NOT NULL DEFAULT 0,
    "depositPaid"        REAL     NOT NULL DEFAULT 0,
    "createdBy"          TEXT     NOT NULL,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_customerId_fkey"       FOREIGN KEY ("customerId")       REFERENCES "Customer"("id")       ON DELETE SET NULL,
    CONSTRAINT "Appointment_providerId_fkey"       FOREIGN KEY ("providerId")       REFERENCES "Employee"("id")       ON DELETE SET NULL,
    CONSTRAINT "Appointment_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "Appointment_appointmentNumber_key" ON "Appointment"("appointmentNumber");
CREATE INDEX "Appointment_customerId_idx"   ON "Appointment"("customerId");
CREATE INDEX "Appointment_providerId_idx"   ON "Appointment"("providerId");
CREATE INDEX "Appointment_scheduledDate_idx" ON "Appointment"("scheduledDate");
CREATE INDEX "Appointment_status_idx"       ON "Appointment"("status");
CREATE INDEX "Appointment_createdAt_idx"    ON "Appointment"("createdAt");

-- ProviderSchedule: weekly availability per provider
CREATE TABLE "ProviderSchedule" (
    "id"           TEXT     NOT NULL PRIMARY KEY,
    "providerId"   TEXT     NOT NULL,
    "dayOfWeek"    INTEGER  NOT NULL,
    "isWorking"    BOOLEAN  NOT NULL DEFAULT 1,
    "startTime"    TEXT     NOT NULL,
    "endTime"      TEXT     NOT NULL,
    "breakStart"   TEXT,
    "breakEnd"     TEXT,
    "slotDuration" INTEGER  NOT NULL DEFAULT 30,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderSchedule_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Employee"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "ProviderSchedule_providerId_dayOfWeek_key" ON "ProviderSchedule"("providerId", "dayOfWeek");
CREATE INDEX "ProviderSchedule_providerId_idx" ON "ProviderSchedule"("providerId");

-- ClinicHoliday: blocked days (whole clinic or per-provider)
CREATE TABLE "ClinicHoliday" (
    "id"         TEXT     NOT NULL PRIMARY KEY,
    "date"       DATETIME NOT NULL,
    "name"       TEXT     NOT NULL,
    "isGlobal"   BOOLEAN  NOT NULL DEFAULT 1,
    "providerId" TEXT,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ClinicHoliday_date_idx"       ON "ClinicHoliday"("date");
CREATE INDEX "ClinicHoliday_providerId_idx" ON "ClinicHoliday"("providerId");

-- CancellationPolicy: business-level cancellation rule
CREATE TABLE "CancellationPolicy" (
    "id"                   TEXT     NOT NULL PRIMARY KEY,
    "noticePeriodHours"    INTEGER  NOT NULL DEFAULT 24,
    "cancellationFeeType"  TEXT     NOT NULL DEFAULT 'NONE',
    "cancellationFeeValue" REAL     NOT NULL DEFAULT 0,
    "notes"                TEXT,
    "isActive"             BOOLEAN  NOT NULL DEFAULT 1,
    "createdAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- NotificationQueue: local WhatsApp deep-link notification engine
CREATE TABLE "NotificationQueue" (
    "id"               TEXT     NOT NULL PRIMARY KEY,
    "appointmentId"    TEXT,
    "customerId"       TEXT,
    "customerName"     TEXT,
    "customerPhone"    TEXT,
    "notificationType" TEXT     NOT NULL,
    "templateBody"     TEXT     NOT NULL,
    "whatsappLink"     TEXT,
    "scheduledFor"     DATETIME,
    "status"           TEXT     NOT NULL DEFAULT 'PENDING',
    "sentAt"           DATETIME,
    "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "NotificationQueue_status_idx"        ON "NotificationQueue"("status");
CREATE INDEX "NotificationQueue_appointmentId_idx" ON "NotificationQueue"("appointmentId");
CREATE INDEX "NotificationQueue_customerId_idx"    ON "NotificationQueue"("customerId");
CREATE INDEX "NotificationQueue_scheduledFor_idx"  ON "NotificationQueue"("scheduledFor");
