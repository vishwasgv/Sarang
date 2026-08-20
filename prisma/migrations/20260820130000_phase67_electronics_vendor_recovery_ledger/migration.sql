-- Phase 67 item — Electronics's vendor warranty-claim recovery ledger. Three
-- plain nullable/defaulted columns, no FK — simple ADD COLUMN suffices, same
-- as the RMA SLA tracker's own vendorSlaDueDate migration before this one.
ALTER TABLE "RepairTicket" ADD COLUMN "vendorClaimAmount" REAL;
ALTER TABLE "RepairTicket" ADD COLUMN "vendorRecoveredAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "RepairTicket" ADD COLUMN "vendorClaimClosedAt" DATETIME;
