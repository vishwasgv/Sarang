-- AlterTable
ALTER TABLE "PropertyDeal" ADD COLUMN "coBrokerName" TEXT;
ALTER TABLE "PropertyDeal" ADD COLUMN "coBrokerShareAmount" DECIMAL;
ALTER TABLE "PropertyDeal" ADD COLUMN "coBrokerSharePercent" DECIMAL;

-- CreateTable
CREATE TABLE "PropertySiteVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inquiryId" TEXT NOT NULL,
    "scheduledDate" DATETIME NOT NULL,
    "scheduledTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "feedback" TEXT,
    "interestLevel" TEXT,
    "completedDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertySiteVisit_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "PropertyInquiry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PropertySiteVisit_inquiryId_idx" ON "PropertySiteVisit"("inquiryId");

-- CreateIndex
CREATE INDEX "PropertySiteVisit_scheduledDate_idx" ON "PropertySiteVisit"("scheduledDate");
