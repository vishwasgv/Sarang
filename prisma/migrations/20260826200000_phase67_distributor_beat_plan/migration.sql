-- Phase 67 §9.1 — Distributor item 2: Beat-Plan Route Sequencing.
-- Two brand-new tables, both simple CREATE TABLE (no RedefineTables needed
-- since neither pre-exists).

CREATE TABLE "DistributorBeat" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "name"      TEXT NOT NULL,
    "repName"   TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "DistributorBeat_repName_idx" ON "DistributorBeat"("repName");
CREATE INDEX "DistributorBeat_isActive_idx" ON "DistributorBeat"("isActive");

CREATE TABLE "DistributorBeatStop" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "beatId"        TEXT NOT NULL,
    "customerId"    TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    CONSTRAINT "DistributorBeatStop_beatId_fkey"     FOREIGN KEY ("beatId")     REFERENCES "DistributorBeat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DistributorBeatStop_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"        ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DistributorBeatStop_beatId_customerId_key" ON "DistributorBeatStop"("beatId", "customerId");
CREATE INDEX "DistributorBeatStop_beatId_idx" ON "DistributorBeatStop"("beatId");
CREATE INDEX "DistributorBeatStop_customerId_idx" ON "DistributorBeatStop"("customerId");
