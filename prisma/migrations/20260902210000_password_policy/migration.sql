-- 2026-09-02 — Password Policy: expiry (passwordChangedAt on User, checked
-- against the configurable 'password_expiry_days' Setting at login) and
-- history (PasswordHistory, checked against 'password_history_count' at
-- every change/reset to block reuse). Minimum-length strength already
-- existed via 'password_min_length'; these two close the rest of the gap.

-- AlterTable
-- SQLite's ALTER TABLE ADD COLUMN rejects a non-constant default
-- (CURRENT_TIMESTAMP isn't constant), so this backfills every existing row
-- via UPDATE right after — same two-step shape this codebase's other
-- migrations already use for adding a DATETIME column to a populated table.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" DATETIME;
UPDATE "User" SET "passwordChangedAt" = CURRENT_TIMESTAMP WHERE "passwordChangedAt" IS NULL;

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PasswordHistory_userId_idx" ON "PasswordHistory"("userId");
