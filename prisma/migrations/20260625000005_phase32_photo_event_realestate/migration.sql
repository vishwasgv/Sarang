-- Phase 32: Photography Studio, Event Management, Real Estate
-- Adds: ShootBooking, DeliveryTracker, EventBooking, EventVendorBooking,
--       Property, PropertyInquiry, PropertyDeal

-- ShootBooking (FK → Customer, Employee)
CREATE TABLE IF NOT EXISTS "ShootBooking" (
  "id"                     TEXT NOT NULL PRIMARY KEY,
  "clientId"               TEXT NOT NULL,
  "shootType"              TEXT NOT NULL,
  "shootDate"              DATETIME NOT NULL,
  "shootTime"              TEXT,
  "shootLocation"          TEXT NOT NULL,
  "estimatedDurationHours" DECIMAL NOT NULL,
  "deliverableType"        TEXT NOT NULL DEFAULT 'DIGITAL_ONLY',
  "expectedPhotosCount"    INTEGER,
  "deliveryDeadline"       DATETIME,
  "photographerIds"        TEXT NOT NULL DEFAULT '[]',
  "editorAssignedId"       TEXT,
  "status"                 TEXT NOT NULL DEFAULT 'INQUIRY',
  "invoiceId"              TEXT,
  "notes"                  TEXT,
  "createdAt"              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              DATETIME NOT NULL,
  CONSTRAINT "ShootBooking_clientId_fkey"       FOREIGN KEY ("clientId")       REFERENCES "Customer"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "ShootBooking_editorAssignedId_fkey" FOREIGN KEY ("editorAssignedId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ShootBooking_clientId_idx"  ON "ShootBooking"("clientId");
CREATE INDEX "ShootBooking_shootDate_idx" ON "ShootBooking"("shootDate");
CREATE INDEX "ShootBooking_status_idx"    ON "ShootBooking"("status");

-- DeliveryTracker (FK → ShootBooking, 1-to-1)
CREATE TABLE IF NOT EXISTS "DeliveryTracker" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "shootBookingId"        TEXT NOT NULL UNIQUE,
  "proofsSentDate"        DATETIME,
  "selectionReceivedDate" DATETIME,
  "editingStartedDate"    DATETIME,
  "albumProofSentDate"    DATETIME,
  "finalDeliveredDate"    DATETIME,
  "deliveryFormat"        TEXT,
  "notes"                 TEXT,
  "createdAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             DATETIME NOT NULL,
  CONSTRAINT "DeliveryTracker_shootBookingId_fkey" FOREIGN KEY ("shootBookingId") REFERENCES "ShootBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- EventBooking (FK → Customer)
CREATE TABLE IF NOT EXISTS "EventBooking" (
  "id"                 TEXT NOT NULL PRIMARY KEY,
  "clientId"           TEXT NOT NULL,
  "eventName"          TEXT NOT NULL,
  "eventType"          TEXT NOT NULL,
  "eventDate"          DATETIME NOT NULL,
  "eventEndDate"       DATETIME,
  "venueName"          TEXT NOT NULL,
  "venueAddress"       TEXT,
  "expectedGuestCount" INTEGER,
  "clientBudget"       DECIMAL,
  "status"             TEXT NOT NULL DEFAULT 'INQUIRY',
  "invoiceId"          TEXT,
  "notes"              TEXT,
  "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          DATETIME NOT NULL,
  CONSTRAINT "EventBooking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EventBooking_clientId_idx"  ON "EventBooking"("clientId");
CREATE INDEX "EventBooking_eventDate_idx" ON "EventBooking"("eventDate");
CREATE INDEX "EventBooking_status_idx"    ON "EventBooking"("status");

-- EventVendorBooking (FK → EventBooking, Supplier)
CREATE TABLE IF NOT EXISTS "EventVendorBooking" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "eventId"        TEXT NOT NULL,
  "vendorId"       TEXT NOT NULL,
  "vendorCategory" TEXT NOT NULL,
  "quotedAmount"   DECIMAL NOT NULL,
  "advancePaid"    DECIMAL NOT NULL DEFAULT 0,
  "status"         TEXT NOT NULL DEFAULT 'ENQUIRED',
  "notes"          TEXT,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      DATETIME NOT NULL,
  CONSTRAINT "EventVendorBooking_eventId_fkey"  FOREIGN KEY ("eventId")  REFERENCES "EventBooking"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "EventVendorBooking_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Supplier"("id")     ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "EventVendorBooking_eventId_idx"  ON "EventVendorBooking"("eventId");
CREATE INDEX "EventVendorBooking_vendorId_idx" ON "EventVendorBooking"("vendorId");
CREATE INDEX "EventVendorBooking_status_idx"   ON "EventVendorBooking"("status");

-- Property (FK → Customer as owner)
CREATE TABLE IF NOT EXISTS "Property" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "propertyType"     TEXT NOT NULL,
  "listingType"      TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'AVAILABLE',
  "location"         TEXT NOT NULL,
  "area"             DECIMAL NOT NULL,
  "floorNumber"      INTEGER,
  "totalFloors"      INTEGER,
  "askingPrice"      DECIMAL,
  "monthlyRent"      DECIMAL,
  "securityDeposit"  DECIMAL,
  "ownerClientId"    TEXT NOT NULL,
  "brokeragePercent" DECIMAL,
  "photos"           TEXT NOT NULL DEFAULT '[]',
  "description"      TEXT,
  "amenities"        TEXT NOT NULL DEFAULT '[]',
  "notes"            TEXT,
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        DATETIME NOT NULL,
  CONSTRAINT "Property_ownerClientId_fkey" FOREIGN KEY ("ownerClientId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Property_status_idx"        ON "Property"("status");
CREATE INDEX "Property_listingType_idx"   ON "Property"("listingType");
CREATE INDEX "Property_ownerClientId_idx" ON "Property"("ownerClientId");

-- PropertyInquiry (FK → Property, Customer as buyer)
CREATE TABLE IF NOT EXISTS "PropertyInquiry" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "propertyId"       TEXT NOT NULL,
  "buyerClientId"    TEXT NOT NULL,
  "inquiryDate"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"           TEXT NOT NULL DEFAULT 'SHORTLISTED',
  "notes"            TEXT,
  "nextFollowUpDate" DATETIME,
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        DATETIME NOT NULL,
  CONSTRAINT "PropertyInquiry_propertyId_fkey"    FOREIGN KEY ("propertyId")    REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PropertyInquiry_buyerClientId_fkey" FOREIGN KEY ("buyerClientId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PropertyInquiry_propertyId_idx"    ON "PropertyInquiry"("propertyId");
CREATE INDEX "PropertyInquiry_buyerClientId_idx" ON "PropertyInquiry"("buyerClientId");
CREATE INDEX "PropertyInquiry_status_idx"        ON "PropertyInquiry"("status");

-- PropertyDeal (FK → Property, Customer x2 as buyer and seller)
CREATE TABLE IF NOT EXISTS "PropertyDeal" (
  "id"                       TEXT NOT NULL PRIMARY KEY,
  "propertyId"               TEXT NOT NULL,
  "buyerClientId"            TEXT NOT NULL,
  "sellerClientId"           TEXT NOT NULL,
  "dealValue"                DECIMAL NOT NULL,
  "brokeragePercent"         DECIMAL NOT NULL,
  "brokerageAmount"          DECIMAL NOT NULL,
  "expectedRegistrationDate" DATETIME,
  "status"                   TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "invoiceId"                TEXT,
  "notes"                    TEXT,
  "createdAt"                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                DATETIME NOT NULL,
  CONSTRAINT "PropertyDeal_propertyId_fkey"    FOREIGN KEY ("propertyId")    REFERENCES "Property"("id")  ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "PropertyDeal_buyerClientId_fkey" FOREIGN KEY ("buyerClientId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PropertyDeal_sellerClientId_fkey" FOREIGN KEY ("sellerClientId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PropertyDeal_propertyId_idx" ON "PropertyDeal"("propertyId");
CREATE INDEX "PropertyDeal_status_idx"     ON "PropertyDeal"("status");
