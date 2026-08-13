-- Phase 64 — seed exactly one default Location ("Main", isDefault=true) and
-- back-fill LocationStock for every existing product from its current
-- Inventory.quantity, so every pre-Phase-64 install (and every install that
-- never turns on multi-location) behaves identically to today: one
-- location, same totals, no location picker shown anywhere in the UI.
-- Inventory itself is untouched by this migration (see Section 6.1 item 2's
-- own documented reasoning for why LocationStock is a pure additive
-- breakdown, never a second source of truth for the aggregate).
INSERT INTO "Location" ("id", "name", "address", "isDefault", "isActive", "createdAt", "updatedAt")
VALUES ('loc_main_default', 'Main', NULL, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "LocationStock" ("id", "productId", "locationId", "quantity", "updatedAt")
SELECT lower(hex(randomblob(16))), "productId", 'loc_main_default', "quantity", CURRENT_TIMESTAMP
FROM "Inventory";
