-- CreateTable
CREATE TABLE "StudentTestScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollmentId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "subject" TEXT,
    "marksObtained" REAL NOT NULL,
    "maxMarks" REAL NOT NULL,
    "testDate" DATETIME NOT NULL,
    "grade" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentTestScore_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CoachingBatchEnrollment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StudentTestScore_enrollmentId_idx" ON "StudentTestScore"("enrollmentId");

-- CreateIndex
CREATE INDEX "StudentTestScore_testDate_idx" ON "StudentTestScore"("testDate");
