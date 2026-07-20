-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT,
    "caseId" TEXT,
    "projectId" TEXT,
    "retainerId" TEXT,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "hours" DECIMAL NOT NULL,
    "ratePerHour" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "isBilled" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ServiceProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "RetainerAgreement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TimeEntry" ("amount", "caseId", "createdAt", "date", "description", "employeeId", "hours", "id", "invoiceId", "isBilled", "projectId", "ratePerHour", "retainerId", "updatedAt") SELECT "amount", "caseId", "createdAt", "date", "description", "employeeId", "hours", "id", "invoiceId", "isBilled", "projectId", "ratePerHour", "retainerId", "updatedAt" FROM "TimeEntry";
DROP TABLE "TimeEntry";
ALTER TABLE "new_TimeEntry" RENAME TO "TimeEntry";
CREATE INDEX "TimeEntry_employeeId_idx" ON "TimeEntry"("employeeId");
CREATE INDEX "TimeEntry_caseId_idx" ON "TimeEntry"("caseId");
CREATE INDEX "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");
CREATE INDEX "TimeEntry_retainerId_idx" ON "TimeEntry"("retainerId");
CREATE INDEX "TimeEntry_date_idx" ON "TimeEntry"("date");
CREATE INDEX "TimeEntry_isBilled_idx" ON "TimeEntry"("isBilled");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
