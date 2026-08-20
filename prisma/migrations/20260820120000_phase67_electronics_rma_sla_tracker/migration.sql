-- Phase 67 item — Electronics's RMA SLA tracker. A due-date, set once when
-- a RepairTicket transitions to SENT_TO_VENDOR, so an overdue vendor return
-- can be flagged automatically instead of relying on someone remembering to
-- chase it. Plain nullable column, no FK, so a simple ADD COLUMN suffices
-- (no SQLite table-rebuild needed, unlike the FK-carrying migration before this one).
ALTER TABLE "RepairTicket" ADD COLUMN "vendorSlaDueDate" DATETIME;
