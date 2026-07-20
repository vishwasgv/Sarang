-- AlterTable
ALTER TABLE "SiteVisit" ADD COLUMN "latitude" REAL;
ALTER TABLE "SiteVisit" ADD COLUMN "locationAccuracy" REAL;
ALTER TABLE "SiteVisit" ADD COLUMN "longitude" REAL;

-- CreateTable
CREATE TABLE "MaterialTestResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteVisitId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "materialDescription" TEXT,
    "testValue" REAL,
    "unit" TEXT,
    "requiredMinValue" REAL,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "testedDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaterialTestResult_siteVisitId_fkey" FOREIGN KEY ("siteVisitId") REFERENCES "SiteVisit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MaterialTestResult_siteVisitId_idx" ON "MaterialTestResult"("siteVisitId");
