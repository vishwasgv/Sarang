-- Phase 67 §9.1 item 23.1 — Diagnostic Lab: per-test TAT target vs. actual.
-- Additive-only: nullable columns on two existing tables, no data rewritten.

-- AlterTable
ALTER TABLE "ServiceCatalog" ADD COLUMN "targetTATHours" INTEGER;

-- AlterTable
ALTER TABLE "LabTestOrderItem" ADD COLUMN "targetTATHours" INTEGER;
ALTER TABLE "LabTestOrderItem" ADD COLUMN "resultReadyAt" DATETIME;
