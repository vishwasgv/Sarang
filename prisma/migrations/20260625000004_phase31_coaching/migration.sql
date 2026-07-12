-- Phase 31: Coaching Institute / Tuition / Academy
-- Adds StudentProfile, CoachingBatch, CoachingBatchEnrollment,
--          CoachingBatchAttendance, CoachingFeeRecord, Performance
-- CoachingFeeRecord includes GST columns (baseAmount, taxRate, taxAmount)

-- CoachingBatch (must be before Enrollment, Attendance, FeeRecord, Performance)
CREATE TABLE "CoachingBatch" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "batchName"       TEXT NOT NULL,
  "subjectOrCourse" TEXT NOT NULL,
  "instructorId"    TEXT,
  "scheduleDays"    TEXT NOT NULL DEFAULT '[]',
  "scheduleTime"    TEXT,
  "roomOrLocation"  TEXT,
  "maxCapacity"     INTEGER NOT NULL DEFAULT 20,
  "startDate"       DATETIME NOT NULL,
  "endDate"         DATETIME,
  "status"          TEXT NOT NULL DEFAULT 'ACTIVE',
  "feePerMonth"     DECIMAL NOT NULL,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       DATETIME NOT NULL,
  CONSTRAINT "CoachingBatch_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CoachingBatch_status_idx"      ON "CoachingBatch"("status");
CREATE INDEX "CoachingBatch_instructorId_idx" ON "CoachingBatch"("instructorId");

-- CoachingBatchEnrollment (FK → CoachingBatch, Customer)
CREATE TABLE "CoachingBatchEnrollment" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "batchId"        TEXT NOT NULL,
  "studentId"      TEXT NOT NULL,
  "enrolledDate"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"         TEXT NOT NULL DEFAULT 'ACTIVE',
  "discountType"   TEXT NOT NULL DEFAULT 'NONE',
  "discountAmount" DECIMAL NOT NULL DEFAULT 0,
  "effectiveFee"   DECIMAL NOT NULL,
  "notes"          TEXT,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      DATETIME NOT NULL,
  CONSTRAINT "CoachingBatchEnrollment_batchId_fkey"   FOREIGN KEY ("batchId")   REFERENCES "CoachingBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CoachingBatchEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Customer"("id")      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CoachingBatchEnrollment_batchId_studentId_key" ON "CoachingBatchEnrollment"("batchId", "studentId");
CREATE INDEX "CoachingBatchEnrollment_batchId_idx"   ON "CoachingBatchEnrollment"("batchId");
CREATE INDEX "CoachingBatchEnrollment_studentId_idx" ON "CoachingBatchEnrollment"("studentId");
CREATE INDEX "CoachingBatchEnrollment_status_idx"    ON "CoachingBatchEnrollment"("status");

-- CoachingBatchAttendance (FK → CoachingBatch, Employee)
CREATE TABLE "CoachingBatchAttendance" (
  "id"                TEXT NOT NULL PRIMARY KEY,
  "batchId"           TEXT NOT NULL,
  "attendanceDate"    DATETIME NOT NULL,
  "presentStudentIds" TEXT NOT NULL DEFAULT '[]',
  "absentStudentIds"  TEXT NOT NULL DEFAULT '[]',
  "takenById"         TEXT,
  "notes"             TEXT,
  "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         DATETIME NOT NULL,
  CONSTRAINT "CoachingBatchAttendance_batchId_fkey"   FOREIGN KEY ("batchId")   REFERENCES "CoachingBatch"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "CoachingBatchAttendance_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "Employee"("id")      ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CoachingBatchAttendance_batchId_attendanceDate_key" ON "CoachingBatchAttendance"("batchId", "attendanceDate");
CREATE INDEX "CoachingBatchAttendance_batchId_idx"        ON "CoachingBatchAttendance"("batchId");
CREATE INDEX "CoachingBatchAttendance_attendanceDate_idx" ON "CoachingBatchAttendance"("attendanceDate");

-- CoachingFeeRecord (FK → CoachingBatchEnrollment, CoachingBatch)
-- Includes GST columns from the start: baseAmount, taxRate, taxAmount
CREATE TABLE "CoachingFeeRecord" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "enrollmentId"   TEXT NOT NULL,
  "studentId"      TEXT NOT NULL,
  "batchId"        TEXT NOT NULL,
  "feeMonth"       TEXT NOT NULL,
  "dueDate"        DATETIME,
  "baseAmount"     DECIMAL NOT NULL DEFAULT 0,
  "taxRate"        DECIMAL NOT NULL DEFAULT 0,
  "taxAmount"      DECIMAL NOT NULL DEFAULT 0,
  "amountDue"      DECIMAL NOT NULL,
  "amountReceived" DECIMAL NOT NULL DEFAULT 0,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "paidDate"       DATETIME,
  "notes"          TEXT,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      DATETIME NOT NULL,
  CONSTRAINT "CoachingFeeRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CoachingBatchEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CoachingFeeRecord_batchId_fkey"      FOREIGN KEY ("batchId")      REFERENCES "CoachingBatch"("id")           ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CoachingFeeRecord_enrollmentId_feeMonth_key" ON "CoachingFeeRecord"("enrollmentId", "feeMonth");
CREATE INDEX "CoachingFeeRecord_batchId_idx"   ON "CoachingFeeRecord"("batchId");
CREATE INDEX "CoachingFeeRecord_studentId_idx" ON "CoachingFeeRecord"("studentId");
CREATE INDEX "CoachingFeeRecord_status_idx"    ON "CoachingFeeRecord"("status");
CREATE INDEX "CoachingFeeRecord_feeMonth_idx"  ON "CoachingFeeRecord"("feeMonth");

-- StudentProfile (FK → Customer)
CREATE TABLE "StudentProfile" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "customerId"     TEXT NOT NULL UNIQUE,
  "rollNumber"     TEXT,
  "classOrGrade"   TEXT NOT NULL,
  "schoolName"     TEXT,
  "parentPhone"    TEXT,
  "enrollmentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      DATETIME NOT NULL,
  CONSTRAINT "StudentProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StudentProfile_isActive_idx" ON "StudentProfile"("isActive");

-- Performance (FK → CoachingBatch)
CREATE TABLE "Performance" (
  "id"                      TEXT NOT NULL PRIMARY KEY,
  "batchId"                 TEXT NOT NULL,
  "performanceName"         TEXT NOT NULL,
  "date"                    DATETIME NOT NULL,
  "venue"                   TEXT,
  "participatingStudentIds" TEXT NOT NULL DEFAULT '[]',
  "notes"                   TEXT,
  "createdAt"               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               DATETIME NOT NULL,
  CONSTRAINT "Performance_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CoachingBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Performance_batchId_idx" ON "Performance"("batchId");
CREATE INDEX "Performance_date_idx"    ON "Performance"("date");
