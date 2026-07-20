-- CreateTable
CREATE TABLE "SyllabusTopic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "topicName" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL DEFAULT 0,
    "plannedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SyllabusTopic_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CoachingBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SyllabusTopic_batchId_idx" ON "SyllabusTopic"("batchId");
