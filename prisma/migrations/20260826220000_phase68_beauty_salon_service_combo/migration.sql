-- Phase 68 §9.1 — Beauty Salon item 5: service-combo package builder.
-- Two brand-new tables, both simple CREATE TABLE (no RedefineTables needed
-- since neither pre-exists).

CREATE TABLE "ServiceCombo" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "comboName"   TEXT NOT NULL,
    "description" TEXT,
    "comboPrice"  REAL NOT NULL,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL
);
CREATE INDEX "ServiceCombo_isActive_idx" ON "ServiceCombo"("isActive");

CREATE TABLE "ServiceComboItem" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "comboId"          TEXT NOT NULL,
    "serviceCatalogId" TEXT NOT NULL,
    CONSTRAINT "ServiceComboItem_comboId_fkey"          FOREIGN KEY ("comboId")          REFERENCES "ServiceCombo"   ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceComboItem_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ServiceComboItem_comboId_serviceCatalogId_key" ON "ServiceComboItem"("comboId", "serviceCatalogId");
CREATE INDEX "ServiceComboItem_comboId_idx" ON "ServiceComboItem"("comboId");
CREATE INDEX "ServiceComboItem_serviceCatalogId_idx" ON "ServiceComboItem"("serviceCatalogId");
