-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "customerClass" TEXT;

-- CreateTable
CREATE TABLE "CustomerClassPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "customerClass" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerClassPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldOrderRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repName" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "invoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "FieldOrderRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldOrderRequestItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "FieldOrderRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FieldOrderRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipmentStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "destinationAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveredAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipmentStop_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShipmentStop_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShipmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "unitValue" REAL NOT NULL DEFAULT 0,
    "totalValue" REAL NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "serialNumber" TEXT,
    "notes" TEXT,
    "stopId" TEXT,
    CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShipmentItem_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "ShipmentStop" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShipmentItem" ("batchNumber", "id", "notes", "productId", "productName", "quantity", "serialNumber", "shipmentId", "totalValue", "unit", "unitValue") SELECT "batchNumber", "id", "notes", "productId", "productName", "quantity", "serialNumber", "shipmentId", "totalValue", "unit", "unitValue" FROM "ShipmentItem";
DROP TABLE "ShipmentItem";
ALTER TABLE "new_ShipmentItem" RENAME TO "ShipmentItem";
CREATE INDEX "ShipmentItem_shipmentId_idx" ON "ShipmentItem"("shipmentId");
CREATE INDEX "ShipmentItem_stopId_idx" ON "ShipmentItem"("stopId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CustomerClassPrice_productId_idx" ON "CustomerClassPrice"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerClassPrice_productId_customerClass_key" ON "CustomerClassPrice"("productId", "customerClass");

-- CreateIndex
CREATE INDEX "FieldOrderRequest_customerId_idx" ON "FieldOrderRequest"("customerId");

-- CreateIndex
CREATE INDEX "FieldOrderRequest_status_idx" ON "FieldOrderRequest"("status");

-- CreateIndex
CREATE INDEX "FieldOrderRequestItem_requestId_idx" ON "FieldOrderRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "ShipmentStop_shipmentId_idx" ON "ShipmentStop"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentStop_customerId_idx" ON "ShipmentStop"("customerId");
