-- Phase 58 §2 — Beauty Salon: stylist skill-matching (which staff can perform which service)
CREATE TABLE "ServiceProviderSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "serviceCatalogId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceProviderSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceProviderSkill_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ServiceProviderSkill_employeeId_idx" ON "ServiceProviderSkill"("employeeId");
CREATE INDEX "ServiceProviderSkill_serviceCatalogId_idx" ON "ServiceProviderSkill"("serviceCatalogId");
CREATE UNIQUE INDEX "ServiceProviderSkill_employeeId_serviceCatalogId_key" ON "ServiceProviderSkill"("employeeId", "serviceCatalogId");
