-- CreateTable
CREATE TABLE "LabTestOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "patientName" TEXT NOT NULL,
    "patientAge" TEXT,
    "appointmentId" TEXT,
    "referredByProviderId" TEXT,
    "referringNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "sampleCollectedAt" DATETIME,
    "sampleCollectedById" TEXT,
    "reportedAt" DATETIME,
    "reportedById" TEXT,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LabTestOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LabTestOrder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LabTestOrder_referredByProviderId_fkey" FOREIGN KEY ("referredByProviderId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LabTestOrder_sampleCollectedById_fkey" FOREIGN KEY ("sampleCollectedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LabTestOrder_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LabTestOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labTestOrderId" TEXT NOT NULL,
    "serviceCatalogId" TEXT,
    "testName" TEXT NOT NULL,
    "category" TEXT,
    "sampleType" TEXT NOT NULL DEFAULT 'BLOOD',
    "price" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resultParameters" TEXT NOT NULL DEFAULT '[]',
    "resultSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LabTestOrderItem_labTestOrderId_fkey" FOREIGN KEY ("labTestOrderId") REFERENCES "LabTestOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LabTestOrderItem_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LabTestOrder_orderNumber_key" ON "LabTestOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LabTestOrder_appointmentId_key" ON "LabTestOrder"("appointmentId");

-- CreateIndex
CREATE INDEX "LabTestOrder_customerId_idx" ON "LabTestOrder"("customerId");

-- CreateIndex
CREATE INDEX "LabTestOrder_status_idx" ON "LabTestOrder"("status");

-- CreateIndex
CREATE INDEX "LabTestOrder_createdAt_idx" ON "LabTestOrder"("createdAt");

-- CreateIndex
CREATE INDEX "LabTestOrderItem_labTestOrderId_idx" ON "LabTestOrderItem"("labTestOrderId");

-- CreateIndex
CREATE INDEX "LabTestOrderItem_status_idx" ON "LabTestOrderItem"("status");
