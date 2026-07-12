-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointmentNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "providerId" TEXT,
    "serviceCatalogId" TEXT,
    "serviceTitle" TEXT NOT NULL,
    "scheduledDate" DATETIME NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "privateNotes" TEXT,
    "cancellationReason" TEXT,
    "invoiceId" TEXT,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "depositPaid" REAL NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "petId" TEXT,
    "chairAssignment" TEXT,
    "services" TEXT,
    "locationId" TEXT,
    "referredFromVisitNoteId" TEXT,
    CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_referredFromVisitNoteId_fkey" FOREIGN KEY ("referredFromVisitNoteId") REFERENCES "VisitNote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("appointmentNumber", "cancellationReason", "chairAssignment", "createdAt", "createdBy", "customerId", "customerName", "depositPaid", "durationMinutes", "id", "invoiceId", "locationId", "notes", "petId", "privateNotes", "providerId", "scheduledDate", "scheduledTime", "serviceCatalogId", "serviceTitle", "services", "status", "totalAmount", "updatedAt") SELECT "appointmentNumber", "cancellationReason", "chairAssignment", "createdAt", "createdBy", "customerId", "customerName", "depositPaid", "durationMinutes", "id", "invoiceId", "locationId", "notes", "petId", "privateNotes", "providerId", "scheduledDate", "scheduledTime", "serviceCatalogId", "serviceTitle", "services", "status", "totalAmount", "updatedAt" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE UNIQUE INDEX "Appointment_appointmentNumber_key" ON "Appointment"("appointmentNumber");
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");
CREATE INDEX "Appointment_providerId_idx" ON "Appointment"("providerId");
CREATE INDEX "Appointment_scheduledDate_idx" ON "Appointment"("scheduledDate");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX "Appointment_referredFromVisitNoteId_idx" ON "Appointment"("referredFromVisitNoteId");
CREATE INDEX "Appointment_createdAt_idx" ON "Appointment"("createdAt");
CREATE INDEX "Appointment_petId_idx" ON "Appointment"("petId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
