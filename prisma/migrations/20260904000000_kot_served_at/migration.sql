-- 2026-09-04 — Waiter-view feature. DONE only means "ready in the kitchen";
-- servedAt separately tracks "actually delivered to the table", set once a
-- waiter taps "Mark Served" (in-app or from their own LAN waiter view).

-- AlterTable
ALTER TABLE "KOT" ADD COLUMN "servedAt" DATETIME;
