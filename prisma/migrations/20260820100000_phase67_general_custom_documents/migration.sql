-- Phase 67 item — General's Custom Document Builder. A CustomDocumentType
-- is a business-defined document/register (e.g. "Visitor Register"); its
-- own field schema reuses the existing CustomFieldDefinition table via a
-- namespaced entityType key (CUSTOM_DOCUMENT:<id>), so no schema change was
-- needed there. Each logged CustomDocumentEntry stores its values in the
-- same customFields JSON-string convention every other entity already uses.
CREATE TABLE "CustomDocumentType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "CustomDocumentType_isActive_idx" ON "CustomDocumentType"("isActive");

CREATE TABLE "CustomDocumentEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentTypeId" TEXT NOT NULL,
    "entryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customFields" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomDocumentEntry_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "CustomDocumentType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CustomDocumentEntry_documentTypeId_idx" ON "CustomDocumentEntry"("documentTypeId");
CREATE INDEX "CustomDocumentEntry_entryDate_idx" ON "CustomDocumentEntry"("entryDate");
