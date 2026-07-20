-- Phase 58 §2 — GP/Specialist Clinic: structured prescription line items
CREATE TABLE "PrescriptionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitNoteId" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "instructions" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrescriptionItem_visitNoteId_fkey" FOREIGN KEY ("visitNoteId") REFERENCES "VisitNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PrescriptionItem_visitNoteId_idx" ON "PrescriptionItem"("visitNoteId");
