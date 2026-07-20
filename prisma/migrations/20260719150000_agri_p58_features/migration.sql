-- Phase 58 §2 — Agri Inputs: category-specific expiry alert lead time
ALTER TABLE "Product" ADD COLUMN "expiryAlertLeadDays" INTEGER;
