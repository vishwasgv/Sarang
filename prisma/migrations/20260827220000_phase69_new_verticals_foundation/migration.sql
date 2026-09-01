-- Phase 69 §11 — Four New Verticals: Electrical, Plumbing, Stationery,
-- Furniture. Foundation migration: length-billing fields (mirrors
-- sellByWeight), job-site accounts, scheduled delivery, bulk list orders,
-- and furniture deposit-booking/trade-in. Existing large tables
-- (Product/Invoice/InvoiceItem) get plain nullable ADD COLUMNs with no
-- SQLite-level FK constraint, matching this project's own pestContractId
-- precedent (a real Prisma-level relation, enforced at the app layer only,
-- to avoid a full-table rebuild on a heavily-populated table) — brand-new
-- tables below get real FK constraints since CREATE TABLE carries no such
-- rebuild cost.

-- Product: length-based billing (Electrical/Plumbing wire/pipe off a coil)
ALTER TABLE "Product" ADD COLUMN "sellByLength" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "lengthUnit" TEXT;
ALTER TABLE "Product" ADD COLUMN "pricePerLengthUnit" REAL;

-- InvoiceItem: length-billing snapshot
ALTER TABLE "InvoiceItem" ADD COLUMN "lengthUnit" TEXT;

-- Invoice: job-site account tagging + Plumbing scheduled delivery
ALTER TABLE "Invoice" ADD COLUMN "jobSiteAccountId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "scheduledDeliveryDate" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "deliveryAddress" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "deliveryStatus" TEXT;
CREATE INDEX "Invoice_jobSiteAccountId_idx" ON "Invoice"("jobSiteAccountId");

-- Electrical/Plumbing job-site/contractor running account
CREATE TABLE "JobSiteAccount" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "accountName"  TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "siteAddress"  TEXT,
    "status"       TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes"        TEXT,
    "createdById"  TEXT,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL,
    CONSTRAINT "JobSiteAccount_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "JobSiteAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "JobSiteAccount_contractorId_idx" ON "JobSiteAccount"("contractorId");
CREATE INDEX "JobSiteAccount_status_idx" ON "JobSiteAccount"("status");

-- Stationery bulk/institutional list order
CREATE TABLE "BulkListOrder" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "orderNumber"  TEXT NOT NULL,
    "customerId"   TEXT,
    "customerName" TEXT,
    "listName"     TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'DRAFT',
    "invoiceId"    TEXT,
    "notes"        TEXT,
    "createdById"  TEXT,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL,
    CONSTRAINT "BulkListOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BulkListOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BulkListOrder_orderNumber_key" ON "BulkListOrder"("orderNumber");
CREATE INDEX "BulkListOrder_customerId_idx" ON "BulkListOrder"("customerId");
CREATE INDEX "BulkListOrder_status_idx" ON "BulkListOrder"("status");

CREATE TABLE "BulkListOrderItem" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "bulkListOrderId" TEXT NOT NULL,
    "productId"       TEXT,
    "itemLabel"       TEXT NOT NULL,
    "requestedQty"    REAL NOT NULL,
    "unitPrice"       REAL,
    CONSTRAINT "BulkListOrderItem_bulkListOrderId_fkey" FOREIGN KEY ("bulkListOrderId") REFERENCES "BulkListOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BulkListOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "BulkListOrderItem_bulkListOrderId_idx" ON "BulkListOrderItem"("bulkListOrderId");
CREATE INDEX "BulkListOrderItem_productId_idx" ON "BulkListOrderItem"("productId");

-- Furniture deposit + balance booking
CREATE TABLE "FurnitureBooking" (
    "id"                   TEXT NOT NULL PRIMARY KEY,
    "bookingNumber"        TEXT NOT NULL,
    "customerId"           TEXT NOT NULL,
    "deliveryDate"         DATETIME,
    "deliveryAddress"      TEXT,
    "advanceAmount"        REAL NOT NULL DEFAULT 0,
    "advancePaymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "status"               TEXT NOT NULL DEFAULT 'BOOKED',
    "invoiceId"            TEXT,
    "notes"                TEXT,
    "createdById"          TEXT,
    "createdAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            DATETIME NOT NULL,
    CONSTRAINT "FurnitureBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FurnitureBooking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FurnitureBooking_bookingNumber_key" ON "FurnitureBooking"("bookingNumber");
CREATE INDEX "FurnitureBooking_customerId_idx" ON "FurnitureBooking"("customerId");
CREATE INDEX "FurnitureBooking_status_idx" ON "FurnitureBooking"("status");
CREATE INDEX "FurnitureBooking_deliveryDate_idx" ON "FurnitureBooking"("deliveryDate");

CREATE TABLE "FurnitureBookingItem" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "furnitureBookingId" TEXT NOT NULL,
    "productId"          TEXT NOT NULL,
    "quantity"           REAL NOT NULL,
    "unitPrice"          REAL NOT NULL,
    "customFabric"       TEXT,
    "customColor"        TEXT,
    "customDimensions"   TEXT,
    "customFinish"       TEXT,
    CONSTRAINT "FurnitureBookingItem_furnitureBookingId_fkey" FOREIGN KEY ("furnitureBookingId") REFERENCES "FurnitureBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FurnitureBookingItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FurnitureBookingItem_furnitureBookingId_idx" ON "FurnitureBookingItem"("furnitureBookingId");
CREATE INDEX "FurnitureBookingItem_productId_idx" ON "FurnitureBookingItem"("productId");

-- Furniture old-item trade-in (mirrors MetalExchange)
CREATE TABLE "FurnitureTradeIn" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "tradeInNumber"   TEXT NOT NULL,
    "customerId"      TEXT,
    "customerName"    TEXT,
    "itemDescription" TEXT NOT NULL,
    "condition"       TEXT,
    "tradeInValue"    REAL NOT NULL,
    "invoiceId"       TEXT,
    "notes"           TEXT,
    "createdById"     TEXT,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FurnitureTradeIn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FurnitureTradeIn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FurnitureTradeIn_tradeInNumber_key" ON "FurnitureTradeIn"("tradeInNumber");
CREATE INDEX "FurnitureTradeIn_customerId_idx" ON "FurnitureTradeIn"("customerId");
