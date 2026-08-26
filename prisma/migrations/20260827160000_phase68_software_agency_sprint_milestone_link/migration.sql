-- Phase 68 §9.1 — Software Agency item 5: sprint/release-linked billing
-- milestones. Optional link — reuses the existing ServiceProjectMilestone
-- + generateMilestoneInvoice infrastructure instead of a parallel
-- "SprintInvoice" entity.

ALTER TABLE "ServiceProjectMilestone" ADD COLUMN "sprintId" TEXT;
CREATE UNIQUE INDEX "ServiceProjectMilestone_sprintId_key" ON "ServiceProjectMilestone"("sprintId");
