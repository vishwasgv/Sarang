-- CreateTable
CREATE TABLE "BlueprintStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DocumentStageAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "currentStageId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "DocumentStageAssignment_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "BlueprintStage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BlueprintStage_documentType_idx" ON "BlueprintStage"("documentType");

-- CreateIndex
CREATE INDEX "BlueprintStage_documentType_sortOrder_idx" ON "BlueprintStage"("documentType", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentStageAssignment_documentType_documentId_key" ON "DocumentStageAssignment"("documentType", "documentId");

-- CreateIndex
CREATE INDEX "DocumentStageAssignment_currentStageId_idx" ON "DocumentStageAssignment"("currentStageId");
