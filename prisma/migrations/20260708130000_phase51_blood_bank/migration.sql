-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "donorCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "bloodGroup" TEXT,
    "weightKg" REAL,
    "address" TEXT,
    "lastDonationDate" DATETIME,
    "isDeferred" BOOLEAN NOT NULL DEFAULT false,
    "deferralReason" TEXT,
    "deferredUntil" DATETIME,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DonationCamp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campName" TEXT NOT NULL,
    "location" TEXT,
    "campDate" DATETIME NOT NULL,
    "organizer" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DonationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "donationNumber" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "campId" TEXT,
    "collectionDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloodGroup" TEXT NOT NULL,
    "componentType" TEXT NOT NULL DEFAULT 'WHOLE_BLOOD',
    "volumeMl" REAL NOT NULL DEFAULT 450,
    "screeningStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "screeningNotes" TEXT,
    "productBatchId" TEXT,
    "isIssued" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DonationRecord_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DonationRecord_campId_fkey" FOREIGN KEY ("campId") REFERENCES "DonationCamp" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DonationRecord_productBatchId_fkey" FOREIGN KEY ("productBatchId") REFERENCES "ProductBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BloodIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "recipientName" TEXT NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "invoiceId" TEXT,
    "issuedById" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BloodIssue_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BloodIssue_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BloodIssueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bloodIssueId" TEXT NOT NULL,
    "donationRecordId" TEXT NOT NULL,
    "bloodGroup" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "price" REAL NOT NULL DEFAULT 0,
    "compatibilityNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BloodIssueItem_bloodIssueId_fkey" FOREIGN KEY ("bloodIssueId") REFERENCES "BloodIssue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BloodIssueItem_donationRecordId_fkey" FOREIGN KEY ("donationRecordId") REFERENCES "DonationRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Donor_donorCode_key" ON "Donor"("donorCode");

-- CreateIndex
CREATE INDEX "Donor_bloodGroup_idx" ON "Donor"("bloodGroup");

-- CreateIndex
CREATE INDEX "Donor_isActive_idx" ON "Donor"("isActive");

-- CreateIndex
CREATE INDEX "Donor_fullName_idx" ON "Donor"("fullName");

-- CreateIndex
CREATE INDEX "DonationCamp_campDate_idx" ON "DonationCamp"("campDate");

-- CreateIndex
CREATE UNIQUE INDEX "DonationRecord_donationNumber_key" ON "DonationRecord"("donationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DonationRecord_productBatchId_key" ON "DonationRecord"("productBatchId");

-- CreateIndex
CREATE INDEX "DonationRecord_donorId_idx" ON "DonationRecord"("donorId");

-- CreateIndex
CREATE INDEX "DonationRecord_bloodGroup_idx" ON "DonationRecord"("bloodGroup");

-- CreateIndex
CREATE INDEX "DonationRecord_screeningStatus_idx" ON "DonationRecord"("screeningStatus");

-- CreateIndex
CREATE INDEX "DonationRecord_collectionDate_idx" ON "DonationRecord"("collectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "BloodIssue_issueNumber_key" ON "BloodIssue"("issueNumber");

-- CreateIndex
CREATE INDEX "BloodIssue_customerId_idx" ON "BloodIssue"("customerId");

-- CreateIndex
CREATE INDEX "BloodIssue_status_idx" ON "BloodIssue"("status");

-- CreateIndex
CREATE INDEX "BloodIssue_createdAt_idx" ON "BloodIssue"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BloodIssueItem_donationRecordId_key" ON "BloodIssueItem"("donationRecordId");

-- CreateIndex
CREATE INDEX "BloodIssueItem_bloodIssueId_idx" ON "BloodIssueItem"("bloodIssueId");
