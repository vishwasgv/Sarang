-- 2026-09 §12 — Grocery/Kirana vertical item 3: Khata (credit) auto-reminder
-- cadence gate. Purely additive, nullable column, no FK.

ALTER TABLE "Customer" ADD COLUMN "lastKhataReminderSentAt" DATETIME;
