-- Phase 57 (AI Assistant) — additive only, no existing table touched.
CREATE TABLE "AiQueryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "matchedTemplate" TEXT,
    "matchedCategory" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "executionTimeMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiQueryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AiQueryLog_userId_idx" ON "AiQueryLog"("userId");
CREATE INDEX "AiQueryLog_createdAt_idx" ON "AiQueryLog"("createdAt");
