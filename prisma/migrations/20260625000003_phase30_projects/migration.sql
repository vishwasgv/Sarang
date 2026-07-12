-- Phase 30: Architect, Civil Engineer, Consultant, Agency
-- Adds Lead, ServiceProject, ServiceProjectMilestone, RetainerAgreement,
--          Sprint, Issue
-- Also adds projectId FK to TimeEntry (created in Phase 28)

-- Lead
CREATE TABLE "Lead" (
  "id"                TEXT NOT NULL PRIMARY KEY,
  "fullName"          TEXT NOT NULL,
  "email"             TEXT,
  "phone"             TEXT,
  "companyName"       TEXT,
  "source"            TEXT NOT NULL DEFAULT 'REFERRAL',
  "status"            TEXT NOT NULL DEFAULT 'OPEN',
  "estimatedValue"    DECIMAL,
  "assignedToId"      TEXT,
  "convertedClientId" TEXT,
  "notes"             TEXT,
  "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         DATETIME NOT NULL,
  CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Lead_status_idx"      ON "Lead"("status");
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- ServiceProject
CREATE TABLE "ServiceProject" (
  "id"                 TEXT NOT NULL PRIMARY KEY,
  "clientId"           TEXT NOT NULL,
  "projectName"        TEXT NOT NULL,
  "projectType"        TEXT NOT NULL DEFAULT 'GENERAL',
  "stage"              TEXT,
  "status"             TEXT NOT NULL DEFAULT 'ACTIVE',
  "totalContractValue" DECIMAL,
  "startDate"          DATETIME,
  "expectedEndDate"    DATETIME,
  "completedDate"      DATETIME,
  "assignedToId"       TEXT,
  "notes"              TEXT,
  "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          DATETIME NOT NULL,
  CONSTRAINT "ServiceProject_clientId_fkey"    FOREIGN KEY ("clientId")    REFERENCES "Customer"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "ServiceProject_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ServiceProject_clientId_idx"    ON "ServiceProject"("clientId");
CREATE INDEX "ServiceProject_status_idx"      ON "ServiceProject"("status");
CREATE INDEX "ServiceProject_assignedToId_idx" ON "ServiceProject"("assignedToId");

-- ServiceProjectMilestone
CREATE TABLE "ServiceProjectMilestone" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "projectId"       TEXT NOT NULL,
  "milestoneName"   TEXT NOT NULL,
  "milestoneAmount" DECIMAL,
  "status"          TEXT NOT NULL DEFAULT 'UPCOMING',
  "dueDate"         DATETIME,
  "completedDate"   DATETIME,
  "invoiceId"       TEXT,
  "notes"           TEXT,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       DATETIME NOT NULL,
  CONSTRAINT "ServiceProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ServiceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ServiceProjectMilestone_projectId_idx" ON "ServiceProjectMilestone"("projectId");
CREATE INDEX "ServiceProjectMilestone_status_idx"    ON "ServiceProjectMilestone"("status");
CREATE INDEX "ServiceProjectMilestone_dueDate_idx"   ON "ServiceProjectMilestone"("dueDate");

-- RetainerAgreement
CREATE TABLE "RetainerAgreement" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "clientId"      TEXT NOT NULL,
  "assignedToId"  TEXT,
  "title"         TEXT NOT NULL,
  "retainerType"  TEXT NOT NULL DEFAULT 'FIXED_FEE',
  "monthlyAmount" DECIMAL NOT NULL,
  "billingDay"    INTEGER NOT NULL DEFAULT 1,
  "hoursPerMonth" DECIMAL,
  "deliverables"  TEXT,
  "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
  "startDate"     DATETIME NOT NULL,
  "endDate"       DATETIME,
  "notes"         TEXT,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL,
  CONSTRAINT "RetainerAgreement_clientId_fkey"    FOREIGN KEY ("clientId")    REFERENCES "Customer"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "RetainerAgreement_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "RetainerAgreement_clientId_idx"    ON "RetainerAgreement"("clientId");
CREATE INDEX "RetainerAgreement_status_idx"      ON "RetainerAgreement"("status");
CREATE INDEX "RetainerAgreement_assignedToId_idx" ON "RetainerAgreement"("assignedToId");

-- Sprint (must be before Issue since Issue has FK to Sprint)
CREATE TABLE "Sprint" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "projectId"    TEXT NOT NULL,
  "sprintNumber" INTEGER NOT NULL,
  "name"         TEXT,
  "goal"         TEXT,
  "startDate"    DATETIME NOT NULL,
  "endDate"      DATETIME NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'PLANNING',
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    DATETIME NOT NULL,
  CONSTRAINT "Sprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ServiceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Sprint_projectId_sprintNumber_key" ON "Sprint"("projectId", "sprintNumber");
CREATE INDEX "Sprint_projectId_idx" ON "Sprint"("projectId");
CREATE INDEX "Sprint_status_idx"    ON "Sprint"("status");

-- Issue
CREATE TABLE "Issue" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "projectId"    TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "priority"     TEXT NOT NULL DEFAULT 'MED',
  "status"       TEXT NOT NULL DEFAULT 'OPEN',
  "assignedToId" TEXT,
  "sprintId"     TEXT,
  "reportedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedDate" DATETIME,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    DATETIME NOT NULL,
  CONSTRAINT "Issue_projectId_fkey"    FOREIGN KEY ("projectId")    REFERENCES "ServiceProject"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "Issue_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id")       ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Issue_sprintId_fkey"     FOREIGN KEY ("sprintId")     REFERENCES "Sprint"("id")          ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Issue_projectId_idx"    ON "Issue"("projectId");
CREATE INDEX "Issue_status_idx"       ON "Issue"("status");
CREATE INDEX "Issue_assignedToId_idx" ON "Issue"("assignedToId");
CREATE INDEX "Issue_sprintId_idx"     ON "Issue"("sprintId");

-- TimeEntry.projectId FK: add reference column (column already exists from Phase 28, add the constraint via a note)
-- SQLite does not support adding constraints to existing columns.
-- The projectId column was created in Phase 28; Prisma handles the relation at query time via the schema.
-- No DDL change needed here.
