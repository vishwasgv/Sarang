-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DrawingRevision" (
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
    "supersedesId" TEXT,
    "approvedByName" TEXT,
    "approvedDate" DATETIME,
    CONSTRAINT "DrawingRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ServiceProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawingRevision_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "DrawingRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DrawingRevision" ("createdAt", "discipline", "drawingNumber", "id", "issuedDate", "notes", "projectId", "revisionNumber", "status", "title", "updatedAt") SELECT "createdAt", "discipline", "drawingNumber", "id", "issuedDate", "notes", "projectId", "revisionNumber", "status", "title", "updatedAt" FROM "DrawingRevision";
DROP TABLE "DrawingRevision";
ALTER TABLE "new_DrawingRevision" RENAME TO "DrawingRevision";
CREATE UNIQUE INDEX "DrawingRevision_supersedesId_key" ON "DrawingRevision"("supersedesId");
CREATE INDEX "DrawingRevision_projectId_idx" ON "DrawingRevision"("projectId");
CREATE INDEX "DrawingRevision_status_idx" ON "DrawingRevision"("status");
CREATE INDEX "DrawingRevision_drawingNumber_idx" ON "DrawingRevision"("drawingNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
