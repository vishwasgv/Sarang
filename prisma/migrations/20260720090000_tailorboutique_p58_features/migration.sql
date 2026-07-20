-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TailoringOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "measurementRecordId" TEXT,
    "garmentType" TEXT NOT NULL,
    "gender" TEXT,
    "styleRegion" TEXT,
    "fabricDescription" TEXT,
    "fabricSupplied" TEXT NOT NULL DEFAULT 'CLIENT',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL NOT NULL DEFAULT 0,
    "advancePaid" DECIMAL NOT NULL DEFAULT 0,
    "trialDate" DATETIME,
    "deliveryDate" DATETIME,
    "deliveredDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "assignedToId" TEXT,
    "invoiceId" TEXT,
    "specialInstructions" TEXT,
    "notes" TEXT,
    "trialAppointmentId" TEXT,
    "fabricProductId" TEXT,
    "fabricQuantity" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TailoringOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TailoringOrder_measurementRecordId_fkey" FOREIGN KEY ("measurementRecordId") REFERENCES "MeasurementRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TailoringOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TailoringOrder_trialAppointmentId_fkey" FOREIGN KEY ("trialAppointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TailoringOrder_fabricProductId_fkey" FOREIGN KEY ("fabricProductId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TailoringOrder" ("advancePaid", "assignedToId", "clientId", "createdAt", "deliveredDate", "deliveryDate", "fabricDescription", "fabricSupplied", "garmentType", "gender", "id", "invoiceId", "measurementRecordId", "notes", "orderNumber", "quantity", "specialInstructions", "status", "styleRegion", "totalAmount", "trialDate", "unitPrice", "updatedAt") SELECT "advancePaid", "assignedToId", "clientId", "createdAt", "deliveredDate", "deliveryDate", "fabricDescription", "fabricSupplied", "garmentType", "gender", "id", "invoiceId", "measurementRecordId", "notes", "orderNumber", "quantity", "specialInstructions", "status", "styleRegion", "totalAmount", "trialDate", "unitPrice", "updatedAt" FROM "TailoringOrder";
DROP TABLE "TailoringOrder";
ALTER TABLE "new_TailoringOrder" RENAME TO "TailoringOrder";
CREATE UNIQUE INDEX "TailoringOrder_orderNumber_key" ON "TailoringOrder"("orderNumber");
CREATE UNIQUE INDEX "TailoringOrder_trialAppointmentId_key" ON "TailoringOrder"("trialAppointmentId");
CREATE INDEX "TailoringOrder_clientId_idx" ON "TailoringOrder"("clientId");
CREATE INDEX "TailoringOrder_status_idx" ON "TailoringOrder"("status");
CREATE INDEX "TailoringOrder_deliveryDate_idx" ON "TailoringOrder"("deliveryDate");
CREATE INDEX "TailoringOrder_createdAt_idx" ON "TailoringOrder"("createdAt");
CREATE INDEX "TailoringOrder_trialAppointmentId_idx" ON "TailoringOrder"("trialAppointmentId");
CREATE INDEX "TailoringOrder_fabricProductId_idx" ON "TailoringOrder"("fabricProductId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
