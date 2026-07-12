-- CreateTable
CREATE TABLE "DrawingRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "drawingNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discipline" TEXT NOT NULL DEFAULT 'ARCHITECTURAL',
    "revisionNumber" TEXT NOT NULL DEFAULT 'A',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issuedDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DrawingRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ServiceProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "visitDate" DATETIME NOT NULL,
    "visitType" TEXT NOT NULL DEFAULT 'INSPECTION',
    "findings" TEXT,
    "weatherConditions" TEXT,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteVisit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ServiceProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteVisit_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DrawingRevision_projectId_idx" ON "DrawingRevision"("projectId");

-- CreateIndex
CREATE INDEX "DrawingRevision_status_idx" ON "DrawingRevision"("status");

-- CreateIndex
CREATE INDEX "SiteVisit_projectId_idx" ON "SiteVisit"("projectId");

-- CreateIndex
CREATE INDEX "SiteVisit_visitDate_idx" ON "SiteVisit"("visitDate");

