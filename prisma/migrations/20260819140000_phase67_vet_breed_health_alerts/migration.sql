-- Phase 67 §9.1 item 18.3 — Vet Clinic: breed-specific health-alert flagging.
-- New, user-maintained reference table, no data rewritten.

-- CreateTable
CREATE TABLE "BreedHealthAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "species" TEXT NOT NULL,
    "breed" TEXT NOT NULL,
    "alertText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "BreedHealthAlert_species_idx" ON "BreedHealthAlert"("species");
