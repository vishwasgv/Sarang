-- Phase 69 §11 — Plumbing wow feature: Installation Warranty Transfer.
-- Plain nullable ADD COLUMNs with no SQLite-level FK constraint, same
-- pestContractId/jobSiteAccountId precedent (real Prisma-level relation,
-- enforced at the app layer only) to avoid a full-table rebuild on
-- ProductSerial.

ALTER TABLE "ProductSerial" ADD COLUMN "installedCustomerId" TEXT;
ALTER TABLE "ProductSerial" ADD COLUMN "installedAt" DATETIME;
ALTER TABLE "ProductSerial" ADD COLUMN "installationAddress" TEXT;
CREATE INDEX "ProductSerial_installedCustomerId_idx" ON "ProductSerial"("installedCustomerId");
