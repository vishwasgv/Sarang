-- Phase 58 §2 — Vet Clinic: species dimension on NormalRangeReference
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NormalRangeReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testName" TEXT NOT NULL,
    "unit" TEXT,
    "minValue" REAL,
    "maxValue" REAL,
    "gender" TEXT NOT NULL DEFAULT 'ALL',
    "species" TEXT NOT NULL DEFAULT 'ALL',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_NormalRangeReference" ("createdAt", "gender", "id", "isActive", "maxValue", "minValue", "notes", "testName", "unit", "updatedAt") SELECT "createdAt", "gender", "id", "isActive", "maxValue", "minValue", "notes", "testName", "unit", "updatedAt" FROM "NormalRangeReference";
DROP TABLE "NormalRangeReference";
ALTER TABLE "new_NormalRangeReference" RENAME TO "NormalRangeReference";
CREATE INDEX "NormalRangeReference_testName_idx" ON "NormalRangeReference"("testName");
CREATE UNIQUE INDEX "NormalRangeReference_testName_gender_species_key" ON "NormalRangeReference"("testName", "gender", "species");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
