-- Phase 67 §9.1 — Electronics: Repair turnaround by technician.
ALTER TABLE "RepairTicket" ADD COLUMN "technicianId" TEXT;

CREATE INDEX "RepairTicket_technicianId_idx" ON "RepairTicket"("technicianId");
