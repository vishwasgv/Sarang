-- Phases 28 + 29: Legal (Lawyer) + CA/CS
-- Adds LegalCase, Hearing, TimeEntry (Phase 28)
--          ComplianceEvent, ComplianceTask, Engagement, ROCFiling, BoardMeeting (Phase 29)

-- LegalCase
CREATE TABLE "LegalCase" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "caseNumber"      TEXT NOT NULL,
  "caseTitle"       TEXT NOT NULL,
  "caseType"        TEXT NOT NULL DEFAULT 'CIVIL',
  "courtName"       TEXT NOT NULL,
  "courtDistrict"   TEXT,
  "courtState"      TEXT,
  "eCourtId"        TEXT,
  "clientId"        TEXT NOT NULL,
  "advocateId"      TEXT,
  "status"          TEXT NOT NULL DEFAULT 'ACTIVE',
  "filingDate"      DATETIME,
  "nextHearingDate" DATETIME,
  "feeAgreed"       DECIMAL,
  "feeCollected"    DECIMAL NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       DATETIME NOT NULL,
  CONSTRAINT "LegalCase_clientId_fkey"   FOREIGN KEY ("clientId")   REFERENCES "Customer"("id")  ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "LegalCase_advocateId_fkey" FOREIGN KEY ("advocateId") REFERENCES "Employee"("id")  ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "LegalCase_clientId_idx"        ON "LegalCase"("clientId");
CREATE INDEX "LegalCase_status_idx"          ON "LegalCase"("status");
CREATE INDEX "LegalCase_advocateId_idx"      ON "LegalCase"("advocateId");
CREATE INDEX "LegalCase_nextHearingDate_idx" ON "LegalCase"("nextHearingDate");

-- Hearing
CREATE TABLE "Hearing" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "caseId"      TEXT NOT NULL,
  "hearingDate" DATETIME NOT NULL,
  "hearingTime" TEXT,
  "courtRoom"   TEXT,
  "purpose"     TEXT,
  "status"      TEXT NOT NULL DEFAULT 'SCHEDULED',
  "outcome"     TEXT,
  "nextDate"    DATETIME,
  "notes"       TEXT,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL,
  CONSTRAINT "Hearing_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Hearing_caseId_idx"      ON "Hearing"("caseId");
CREATE INDEX "Hearing_hearingDate_idx" ON "Hearing"("hearingDate");
CREATE INDEX "Hearing_status_idx"      ON "Hearing"("status");

-- TimeEntry
CREATE TABLE "TimeEntry" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "employeeId"  TEXT,
  "caseId"      TEXT,
  "projectId"   TEXT,
  "date"        DATETIME NOT NULL,
  "description" TEXT NOT NULL,
  "hours"       DECIMAL NOT NULL,
  "ratePerHour" DECIMAL NOT NULL DEFAULT 0,
  "amount"      DECIMAL NOT NULL DEFAULT 0,
  "isBilled"    BOOLEAN NOT NULL DEFAULT false,
  "invoiceId"   TEXT,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL,
  CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")  ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TimeEntry_caseId_fkey"     FOREIGN KEY ("caseId")     REFERENCES "LegalCase"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "TimeEntry_employeeId_idx" ON "TimeEntry"("employeeId");
CREATE INDEX "TimeEntry_caseId_idx"     ON "TimeEntry"("caseId");
CREATE INDEX "TimeEntry_projectId_idx"  ON "TimeEntry"("projectId");
CREATE INDEX "TimeEntry_date_idx"       ON "TimeEntry"("date");
CREATE INDEX "TimeEntry_isBilled_idx"   ON "TimeEntry"("isBilled");

-- ComplianceEvent
CREATE TABLE "ComplianceEvent" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "title"        TEXT NOT NULL,
  "category"     TEXT NOT NULL,
  "frequency"    TEXT NOT NULL DEFAULT 'ANNUAL',
  "applicableTo" TEXT NOT NULL DEFAULT 'ALL',
  "description"  TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    DATETIME NOT NULL
);

CREATE INDEX "ComplianceEvent_category_idx" ON "ComplianceEvent"("category");
CREATE INDEX "ComplianceEvent_isActive_idx" ON "ComplianceEvent"("isActive");

-- ComplianceTask
CREATE TABLE "ComplianceTask" (
  "id"                TEXT NOT NULL PRIMARY KEY,
  "complianceEventId" TEXT,
  "clientId"          TEXT NOT NULL,
  "staffId"           TEXT,
  "title"             TEXT NOT NULL,
  "category"          TEXT NOT NULL,
  "dueDate"           DATETIME NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'PENDING',
  "priority"          TEXT NOT NULL DEFAULT 'NORMAL',
  "notes"             TEXT,
  "filedOn"           DATETIME,
  "acknowledgmentNo"  TEXT,
  "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         DATETIME NOT NULL,
  CONSTRAINT "ComplianceTask_complianceEventId_fkey" FOREIGN KEY ("complianceEventId") REFERENCES "ComplianceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ComplianceTask_clientId_fkey"          FOREIGN KEY ("clientId")          REFERENCES "Customer"("id")       ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "ComplianceTask_staffId_fkey"           FOREIGN KEY ("staffId")           REFERENCES "Employee"("id")       ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ComplianceTask_clientId_idx"          ON "ComplianceTask"("clientId");
CREATE INDEX "ComplianceTask_dueDate_idx"           ON "ComplianceTask"("dueDate");
CREATE INDEX "ComplianceTask_status_idx"            ON "ComplianceTask"("status");
CREATE INDEX "ComplianceTask_staffId_idx"           ON "ComplianceTask"("staffId");
CREATE INDEX "ComplianceTask_complianceEventId_idx" ON "ComplianceTask"("complianceEventId");

-- Engagement
CREATE TABLE "Engagement" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "clientId"       TEXT NOT NULL,
  "staffId"        TEXT,
  "title"          TEXT NOT NULL,
  "engagementType" TEXT NOT NULL DEFAULT 'RETAINER',
  "status"         TEXT NOT NULL DEFAULT 'ACTIVE',
  "startDate"      DATETIME,
  "endDate"        DATETIME,
  "feeType"        TEXT NOT NULL DEFAULT 'FIXED',
  "feeAmount"      DECIMAL,
  "billingDay"     INTEGER,
  "notes"          TEXT,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      DATETIME NOT NULL,
  CONSTRAINT "Engagement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer"("id")  ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "Engagement_staffId_fkey"  FOREIGN KEY ("staffId")  REFERENCES "Employee"("id")  ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Engagement_clientId_idx" ON "Engagement"("clientId");
CREATE INDEX "Engagement_status_idx"   ON "Engagement"("status");
CREATE INDEX "Engagement_staffId_idx"  ON "Engagement"("staffId");

-- ROCFiling
CREATE TABLE "ROCFiling" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "clientId"      TEXT NOT NULL,
  "staffId"       TEXT,
  "formType"      TEXT NOT NULL,
  "financialYear" TEXT,
  "purpose"       TEXT,
  "dueDate"       DATETIME,
  "filedOn"       DATETIME,
  "srn"           TEXT,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "govtFee"       DECIMAL,
  "notes"         TEXT,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL,
  CONSTRAINT "ROCFiling_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "ROCFiling_staffId_fkey"  FOREIGN KEY ("staffId")  REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ROCFiling_clientId_idx" ON "ROCFiling"("clientId");
CREATE INDEX "ROCFiling_dueDate_idx"  ON "ROCFiling"("dueDate");
CREATE INDEX "ROCFiling_status_idx"   ON "ROCFiling"("status");
CREATE INDEX "ROCFiling_staffId_idx"  ON "ROCFiling"("staffId");

-- BoardMeeting
CREATE TABLE "BoardMeeting" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "clientId"    TEXT NOT NULL,
  "meetingType" TEXT NOT NULL DEFAULT 'BOARD',
  "meetingDate" DATETIME NOT NULL,
  "meetingTime" TEXT,
  "venue"       TEXT,
  "agenda"      TEXT,
  "quorumMet"   BOOLEAN NOT NULL DEFAULT false,
  "minutesDone" BOOLEAN NOT NULL DEFAULT false,
  "noticesSent" BOOLEAN NOT NULL DEFAULT false,
  "notes"       TEXT,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL,
  CONSTRAINT "BoardMeeting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BoardMeeting_clientId_idx"    ON "BoardMeeting"("clientId");
CREATE INDEX "BoardMeeting_meetingDate_idx" ON "BoardMeeting"("meetingDate");
