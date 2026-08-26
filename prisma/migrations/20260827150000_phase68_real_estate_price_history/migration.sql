-- Phase 68 §9.1 — Real Estate item 5: property price-history tracking.
-- Property.askingPrice/monthlyRent had no retained history before this —
-- every previous price silently vanished on edit.

CREATE TABLE "PropertyPriceHistory" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "propertyId"  TEXT NOT NULL,
    "askingPrice" DECIMAL,
    "monthlyRent" DECIMAL,
    "changedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyPriceHistory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PropertyPriceHistory_propertyId_idx" ON "PropertyPriceHistory"("propertyId");
