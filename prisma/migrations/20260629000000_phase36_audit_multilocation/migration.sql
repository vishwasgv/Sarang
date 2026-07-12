-- Phase 36: Hardening + Audit + Multi-location reserved FK columns
-- Three nullable columns reserved for V2 multi-location support (not populated in V1, hidden in UI)

ALTER TABLE "Employee" ADD COLUMN "primaryLocationId" TEXT;
ALTER TABLE "ServiceCatalog" ADD COLUMN "locationId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "locationId" TEXT;
