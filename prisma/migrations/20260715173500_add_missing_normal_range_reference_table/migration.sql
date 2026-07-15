-- Real bug found+fixed 2026-07-15: `NormalRangeReference` has existed in
-- schema.prisma since Phase 54B (vitals normal-range flagging) but was
-- never given a migration — confirmed by cross-checking every model in
-- schema.prisma against every CREATE TABLE statement across all migration
-- files; this was the only one missing. Dev-mode testing never caught it
-- because `prisma db push`/`migrate dev` create tables directly from
-- schema.prisma, masking the gap — only a genuinely fresh install driven
-- through the production migration-runner (db.ts, which replays these SQL
-- files) surfaces it. Confirmed live: a real packaged-build install logged
-- "The table `main.NormalRangeReference` does not exist" on first-run seed.
CREATE TABLE "NormalRangeReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testName" TEXT NOT NULL,
    "unit" TEXT,
    "minValue" REAL,
    "maxValue" REAL,
    "gender" TEXT NOT NULL DEFAULT 'ALL',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "NormalRangeReference_testName_gender_key" ON "NormalRangeReference"("testName", "gender");
CREATE INDEX "NormalRangeReference_testName_idx" ON "NormalRangeReference"("testName");
