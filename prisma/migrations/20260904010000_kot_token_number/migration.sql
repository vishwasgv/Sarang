-- 2026-09-04 — a short, daily-reset customer-facing "Token #N" for
-- counter/takeaway (no tableId) orders, replacing the invoice-number/
-- KOT-XXXXXX fallback. Always null for a real table order.

-- AlterTable
ALTER TABLE "KOT" ADD COLUMN "tokenNumber" INTEGER;
