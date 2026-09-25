-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN "autoReverseOn" DATETIME;

-- CreateTable
CREATE TABLE "JournalMemo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memoDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
