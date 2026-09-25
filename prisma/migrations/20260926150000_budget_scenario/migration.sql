-- AlterTable
ALTER TABLE "Budget" ADD COLUMN "scenario" TEXT NOT NULL DEFAULT 'Base';

-- CreateIndex
CREATE INDEX "Budget_scenario_idx" ON "Budget"("scenario");
