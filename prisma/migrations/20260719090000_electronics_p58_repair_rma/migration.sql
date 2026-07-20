-- Phase 58 §2 — Electronics repair/RMA workflow (RepairTicket)
-- CreateTable
CREATE TABLE "RepairTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimNumber" TEXT NOT NULL,
    "serialId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "issueDescription" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredDate" DATETIME,
    "vendorId" TEXT,
    "vendorRmaNumber" TEXT,
    "sentToVendorDate" DATETIME,
    "vendorResponseDate" DATETIME,
    "replacementSerialId" TEXT,
    "repairCost" REAL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepairTicket_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "ProductSerial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RepairTicket_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RepairTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RepairTicket_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RepairTicket_replacementSerialId_fkey" FOREIGN KEY ("replacementSerialId") REFERENCES "ProductSerial" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RepairTicket_claimNumber_key" ON "RepairTicket"("claimNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RepairTicket_replacementSerialId_key" ON "RepairTicket"("replacementSerialId");

-- CreateIndex
CREATE INDEX "RepairTicket_serialId_idx" ON "RepairTicket"("serialId");

-- CreateIndex
CREATE INDEX "RepairTicket_status_idx" ON "RepairTicket"("status");

-- CreateIndex
CREATE INDEX "RepairTicket_customerId_idx" ON "RepairTicket"("customerId");

-- CreateIndex
CREATE INDEX "RepairTicket_productId_idx" ON "RepairTicket"("productId");
