-- Phase 68 §9.1 — Photo Studio item 5: revision-round tracker.
ALTER TABLE "DeliveryTracker" ADD COLUMN "revisionRounds" INTEGER NOT NULL DEFAULT 0;

-- Phase 68 §9.1 — Photo Studio item 3: studio-owned equipment
-- rental-and-return tracking. Reuses FixedAsset as the equipment registry.
CREATE TABLE "EquipmentCheckout" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "fixedAssetId"       TEXT NOT NULL,
    "shootBookingId"     TEXT,
    "checkedOutToId"     TEXT,
    "checkedOutDate"     DATETIME NOT NULL,
    "expectedReturnDate" DATETIME,
    "actualReturnDate"   DATETIME,
    "notes"              TEXT,
    "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          DATETIME NOT NULL,
    CONSTRAINT "EquipmentCheckout_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentCheckout_shootBookingId_fkey" FOREIGN KEY ("shootBookingId") REFERENCES "ShootBooking" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EquipmentCheckout_checkedOutToId_fkey" FOREIGN KEY ("checkedOutToId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "EquipmentCheckout_fixedAssetId_idx" ON "EquipmentCheckout"("fixedAssetId");
CREATE INDEX "EquipmentCheckout_shootBookingId_idx" ON "EquipmentCheckout"("shootBookingId");
CREATE INDEX "EquipmentCheckout_actualReturnDate_idx" ON "EquipmentCheckout"("actualReturnDate");
