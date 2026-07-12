-- AlterTable
ALTER TABLE "BoardMeeting" ADD COLUMN "minutesText" TEXT;

-- CreateTable
CREATE TABLE "BoardResolution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardMeetingId" TEXT NOT NULL,
    "resolutionNumber" TEXT NOT NULL,
    "resolutionType" TEXT NOT NULL DEFAULT 'ORDINARY',
    "resolutionText" TEXT NOT NULL,
    "passedUnanimously" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BoardResolution_boardMeetingId_fkey" FOREIGN KEY ("boardMeetingId") REFERENCES "BoardMeeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BoardResolution_boardMeetingId_idx" ON "BoardResolution"("boardMeetingId");
