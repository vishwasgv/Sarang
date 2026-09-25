-- CreateTable
CREATE TABLE "PartyAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyType" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "addressText" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PartyAddress_partyType_partyId_idx" ON "PartyAddress"("partyType", "partyId");
