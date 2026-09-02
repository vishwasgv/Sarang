-- 2026-09-02 — a table's dine-in orders now accumulate across multiple
-- rounds (QR scans, or a staff "send another round to kitchen" action)
-- before any Invoice exists, mirroring Hotel/Lodge's HotelExtraCharge ->
-- generateInvoice "accumulate then bill once" pattern. KOT.invoiceId
-- becomes nullable (a KOT is created the moment an order is accepted, so
-- the kitchen sees it immediately, independent of billing) and KOT gets
-- its own KOTItem rows as the source of truth for what was ordered,
-- instead of reading through invoice.items.

-- Hand-written minimal migration (not a full `prisma migrate diff` dump —
-- that pulled in several unrelated table rebuilds, e.g. Bill/Invoice/
-- Payment, that Prisma's diff tool proposes purely because SQLite
-- conservatively wants to touch anything FK-connected to a table being
-- altered; their own column definitions are unchanged, so only KOT itself
-- is actually recreated here).

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_KOT" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT,
    "tableId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KOT_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KOT_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_KOT" ("id", "invoiceId", "tableId", "status", "createdAt", "updatedAt")
  SELECT "id", "invoiceId", "tableId", "status", "createdAt", "updatedAt" FROM "KOT";
DROP TABLE "KOT";
ALTER TABLE "new_KOT" RENAME TO "KOT";
CREATE UNIQUE INDEX "KOT_invoiceId_key" ON "KOT"("invoiceId");
CREATE INDEX "KOT_tableId_idx" ON "KOT"("tableId");
CREATE INDEX "KOT_invoiceId_idx" ON "KOT"("invoiceId");

PRAGMA foreign_keys=ON;

-- KOT's own items — the new source of truth for what was ordered,
-- independent of whether an Invoice exists yet.
CREATE TABLE "KOTItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kotId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceSnapshot" REAL NOT NULL,
    "taxRateSnapshot" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "KOTItem_kotId_fkey" FOREIGN KEY ("kotId") REFERENCES "KOT" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "KOTItem_kotId_idx" ON "KOTItem"("kotId");

-- Set when a customer taps "Checkout" on the QR menu (signals "bring the
-- bill"); purely a staff-facing flag, never auto-bills on its own.
ALTER TABLE "RestaurantTable" ADD COLUMN "checkoutRequestedAt" DATETIME;
