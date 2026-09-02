-- 2026-09-02 — Restaurant/Bakery diet-type marker (VEG|EGG|NON_VEG).
-- Additive nullable column on an existing large table — no FK, matching the
-- established convention for every other Phase-69-style optional Product
-- field (gender, season, recommendedCrop, unavailableUntil, etc.).
ALTER TABLE "Product" ADD COLUMN "foodType" TEXT;
