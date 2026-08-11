-- Phase 61 — fresh-context audit finding (Section 3.1 item 7 of
-- PHASE_61_ROADMAP_MASTER_PROMPT.md): the customerKind column added by
-- 20260811110000_phase61_purchase_side_foundation set a flat 'INDIVIDUAL'
-- default for every existing row, but the spec explicitly calls for
-- existing customers who already carry a GSTIN/tax number to be backfilled
-- to 'BUSINESS' instead — an individual walk-in customer does not have a
-- registered tax number, so this is a safe, conservative signal, not a
-- guess. Real-world installs with existing customer data are affected by
-- this gap; the local dev database this was originally verified against
-- happened to have zero customers with a taxNumber set, which is why the
-- gap was not caught by the original migration's own live verification —
-- caught here on a second, fresh-context pass instead.
UPDATE "Customer"
SET "customerKind" = 'BUSINESS'
WHERE "taxNumber" IS NOT NULL AND TRIM("taxNumber") != '';
