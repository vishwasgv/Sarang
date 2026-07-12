-- Phase 47 — Restaurant QR Table Ordering
-- A customer's QR-scanned order never becomes an Invoice/KOT on its own —
-- staff must explicitly accept it (see restaurant-order.service.ts).

CREATE TABLE "TableOrderRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "invoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "TableOrderRequest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "TableOrderRequestItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "TableOrderRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TableOrderRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TableOrderRequest_tableId_idx" ON "TableOrderRequest"("tableId");
CREATE INDEX "TableOrderRequest_status_idx" ON "TableOrderRequest"("status");
CREATE INDEX "TableOrderRequestItem_requestId_idx" ON "TableOrderRequestItem"("requestId");
