CREATE TABLE "BranchSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchName" TEXT NOT NULL,
    "periodFrom" TEXT NOT NULL,
    "periodTo" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT '',
    "figures" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "generatedAt" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BranchSummary_periodFrom_periodTo_idx" ON "BranchSummary"("periodFrom", "periodTo");
CREATE UNIQUE INDEX "BranchSummary_branchName_periodFrom_periodTo_key" ON "BranchSummary"("branchName", "periodFrom", "periodTo");
