-- AlterTable
ALTER TABLE "JobOrder" ADD COLUMN "feeAgreementTerms" TEXT;
ALTER TABLE "JobOrder" ADD COLUMN "replacementGuaranteeDays" INTEGER;

-- CreateTable
CREATE TABLE "InterviewRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "jobOrderId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "roundType" TEXT NOT NULL DEFAULT 'PHONE_SCREEN',
    "scheduledDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "interviewerName" TEXT,
    "clientFeedback" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InterviewRound_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewRound_jobOrderId_fkey" FOREIGN KEY ("jobOrderId") REFERENCES "JobOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InterviewRound_candidateId_idx" ON "InterviewRound"("candidateId");

-- CreateIndex
CREATE INDEX "InterviewRound_jobOrderId_idx" ON "InterviewRound"("jobOrderId");

-- CreateIndex
CREATE INDEX "InterviewRound_status_idx" ON "InterviewRound"("status");
