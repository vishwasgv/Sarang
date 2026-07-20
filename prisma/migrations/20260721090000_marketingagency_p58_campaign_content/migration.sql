-- CreateTable
CREATE TABLE "CampaignPerformanceEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "conversions" INTEGER,
    "actualSpend" DECIMAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CampaignPerformanceEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ServiceProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentCalendarItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scheduledDate" DATETIME NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'SOCIAL_POST',
    "title" TEXT NOT NULL,
    "platform" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentCalendarItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ServiceProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CampaignPerformanceEntry_projectId_idx" ON "CampaignPerformanceEntry"("projectId");

-- CreateIndex
CREATE INDEX "CampaignPerformanceEntry_periodStart_idx" ON "CampaignPerformanceEntry"("periodStart");

-- CreateIndex
CREATE INDEX "ContentCalendarItem_projectId_idx" ON "ContentCalendarItem"("projectId");

-- CreateIndex
CREATE INDEX "ContentCalendarItem_scheduledDate_idx" ON "ContentCalendarItem"("scheduledDate");
