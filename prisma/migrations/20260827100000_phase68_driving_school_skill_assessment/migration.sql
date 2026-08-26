-- Phase 68 §9.1 — Driving School item 3: learner skill-mastery checklist.
-- One brand-new table, simple CREATE TABLE (no RedefineTables needed).

CREATE TABLE "LearnerSkillAssessment" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "customerId"   TEXT NOT NULL,
    "skillKey"     TEXT NOT NULL,
    "masteryLevel" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "assessedById" TEXT,
    "notes"        TEXT,
    "updatedAt"    DATETIME NOT NULL,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearnerSkillAssessment_customerId_fkey"   FOREIGN KEY ("customerId")   REFERENCES "LearnerProfile" ("customerId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearnerSkillAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "Employee"      ("id")         ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LearnerSkillAssessment_customerId_skillKey_key" ON "LearnerSkillAssessment"("customerId", "skillKey");
CREATE INDEX "LearnerSkillAssessment_customerId_idx" ON "LearnerSkillAssessment"("customerId");
