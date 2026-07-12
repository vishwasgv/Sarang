-- Phase 4: Service Business Module
-- Project, ProjectTask, ServiceTicket, JobCard, WorkLog

CREATE TABLE "Project" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "projectNumber"   TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "description"     TEXT,
    "status"          TEXT NOT NULL DEFAULT 'OPEN',
    "priority"        TEXT NOT NULL DEFAULT 'MEDIUM',
    "customerId"      TEXT,
    "assignedToId"    TEXT,
    "estimatedHours"  REAL NOT NULL DEFAULT 0,
    "estimatedAmount" REAL NOT NULL DEFAULT 0,
    "startDate"       DATETIME,
    "dueDate"         DATETIME,
    "completedDate"   DATETIME,
    "notes"           TEXT,
    "createdById"     TEXT,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL,
    CONSTRAINT "Project_customerId_fkey"   FOREIGN KEY ("customerId")   REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"     ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Project_projectNumber_key" ON "Project"("projectNumber");
CREATE INDEX "Project_status_idx"     ON "Project"("status");
CREATE INDEX "Project_customerId_idx" ON "Project"("customerId");
CREATE INDEX "Project_createdAt_idx"  ON "Project"("createdAt");

CREATE TABLE "ProjectTask" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "projectId"      TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "description"    TEXT,
    "status"         TEXT NOT NULL DEFAULT 'PENDING',
    "priority"       TEXT NOT NULL DEFAULT 'MEDIUM',
    "estimatedHours" REAL NOT NULL DEFAULT 0,
    "dueDate"        DATETIME,
    "completedAt"    DATETIME,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      DATETIME NOT NULL,
    CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProjectTask_projectId_idx" ON "ProjectTask"("projectId");
CREATE INDEX "ProjectTask_status_idx"    ON "ProjectTask"("status");

CREATE TABLE "ServiceTicket" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "ticketNumber" TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT,
    "status"       TEXT NOT NULL DEFAULT 'OPEN',
    "priority"     TEXT NOT NULL DEFAULT 'MEDIUM',
    "category"     TEXT,
    "customerId"   TEXT,
    "assignedToId" TEXT,
    "resolvedAt"   DATETIME,
    "closedAt"     DATETIME,
    "resolution"   TEXT,
    "createdById"  TEXT,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL,
    CONSTRAINT "ServiceTicket_customerId_fkey"   FOREIGN KEY ("customerId")   REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"     ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ServiceTicket_ticketNumber_key"  ON "ServiceTicket"("ticketNumber");
CREATE INDEX "ServiceTicket_status_idx"     ON "ServiceTicket"("status");
CREATE INDEX "ServiceTicket_customerId_idx" ON "ServiceTicket"("customerId");
CREATE INDEX "ServiceTicket_priority_idx"   ON "ServiceTicket"("priority");
CREATE INDEX "ServiceTicket_createdAt_idx"  ON "ServiceTicket"("createdAt");

CREATE TABLE "JobCard" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "jobNumber"       TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "itemDescription" TEXT,
    "status"          TEXT NOT NULL DEFAULT 'RECEIVED',
    "priority"        TEXT NOT NULL DEFAULT 'MEDIUM',
    "customerId"      TEXT,
    "assignedToId"    TEXT,
    "estimatedCost"   REAL NOT NULL DEFAULT 0,
    "actualCost"      REAL NOT NULL DEFAULT 0,
    "receivedDate"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate"    DATETIME,
    "deliveredDate"   DATETIME,
    "notes"           TEXT,
    "internalNotes"   TEXT,
    "createdById"     TEXT,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL,
    CONSTRAINT "JobCard_customerId_fkey"   FOREIGN KEY ("customerId")   REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JobCard_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"     ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "JobCard_jobNumber_key"    ON "JobCard"("jobNumber");
CREATE INDEX "JobCard_status_idx"     ON "JobCard"("status");
CREATE INDEX "JobCard_customerId_idx" ON "JobCard"("customerId");
CREATE INDEX "JobCard_createdAt_idx"  ON "JobCard"("createdAt");

CREATE TABLE "WorkLog" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "projectId"   TEXT,
    "ticketId"    TEXT,
    "jobCardId"   TEXT,
    "userId"      TEXT,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "hours"       REAL NOT NULL DEFAULT 0,
    "logDate"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billable"    BOOLEAN NOT NULL DEFAULT 1,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"       ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkLog_ticketId_fkey"  FOREIGN KEY ("ticketId")  REFERENCES "ServiceTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkLog_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "JobCard"       ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkLog_userId_fkey"    FOREIGN KEY ("userId")    REFERENCES "User"          ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "WorkLog_projectId_idx" ON "WorkLog"("projectId");
CREATE INDEX "WorkLog_ticketId_idx"  ON "WorkLog"("ticketId");
CREATE INDEX "WorkLog_jobCardId_idx" ON "WorkLog"("jobCardId");
CREATE INDEX "WorkLog_userId_idx"    ON "WorkLog"("userId");
CREATE INDEX "WorkLog_logDate_idx"   ON "WorkLog"("logDate");
