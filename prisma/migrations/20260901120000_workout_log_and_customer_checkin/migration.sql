-- 2026-09-01 — Gym/Studio machine-based workout progress tracking, and a
-- universal customer check-in/check-out log (any business, via the
-- customer_checkin opt-in module). Both brand-new tables, real FK
-- constraints (no existing large table to avoid a rebuild for).

CREATE TABLE "WorkoutLog" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "customerId"   TEXT NOT NULL,
    "trainerId"    TEXT,
    "exerciseName" TEXT NOT NULL,
    "machineName"  TEXT,
    "weight"       DECIMAL,
    "reps"         INTEGER,
    "sets"         INTEGER,
    "notes"        TEXT,
    "loggedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkoutLog_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "WorkoutLog_customerId_idx" ON "WorkoutLog"("customerId");
CREATE INDEX "WorkoutLog_loggedAt_idx" ON "WorkoutLog"("loggedAt");

CREATE TABLE "CustomerCheckIn" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "customerId"   TEXT NOT NULL,
    "checkInTime"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutTime" DATETIME,
    "notes"        TEXT,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerCheckIn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CustomerCheckIn_customerId_idx" ON "CustomerCheckIn"("customerId");
CREATE INDEX "CustomerCheckIn_checkInTime_idx" ON "CustomerCheckIn"("checkInTime");
