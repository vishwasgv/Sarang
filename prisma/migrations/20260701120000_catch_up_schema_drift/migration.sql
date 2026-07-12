-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "commissionType" TEXT DEFAULT 'PERCENT';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "reversalReason" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "hsnCode" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionToken" TEXT;
ALTER TABLE "User" ADD COLUMN "tokenExpiresAt" DATETIME;

-- CreateTable
CREATE TABLE "DailyCashClose" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "closeDate" DATETIME NOT NULL,
    "expectedCash" REAL NOT NULL,
    "actualCash" REAL NOT NULL,
    "variance" REAL NOT NULL,
    "notes" TEXT,
    "closedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "fileSizeBytes" BIGINT NOT NULL DEFAULT 0,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "notes" TEXT,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quotationNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "validUntil" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "lineTotal" REAL NOT NULL,
    CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creditNoteNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "invoiceId" TEXT,
    "reason" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DebitNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debitNoteNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseOrderId" TEXT,
    "reason" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DebitNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DebitNote_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "currentJobTitle" TEXT,
    "currentEmployer" TEXT,
    "totalExperience" DECIMAL,
    "skills" TEXT NOT NULL DEFAULT '[]',
    "preferredLocations" TEXT NOT NULL DEFAULT '[]',
    "educationSummary" TEXT,
    "resumeNotes" TEXT,
    "expectedSalary" DECIMAL,
    "currentSalary" DECIMAL,
    "availableFrom" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'WALKIN',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JobOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobDescription" TEXT,
    "requiredSkills" TEXT NOT NULL DEFAULT '[]',
    "experienceMin" DECIMAL,
    "experienceMax" DECIMAL,
    "salaryBudgetMin" DECIMAL,
    "salaryBudgetMax" DECIMAL,
    "location" TEXT,
    "numberOfPositions" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "targetDate" DATETIME,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "commissionValue" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "placementNumber" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobOrderId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "joiningDate" DATETIME NOT NULL,
    "offeredSalary" DECIMAL NOT NULL,
    "commissionAmount" DECIMAL NOT NULL DEFAULT 0,
    "invoiceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFERED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Placement_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Placement_jobOrderId_fkey" FOREIGN KEY ("jobOrderId") REFERENCES "JobOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Placement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL DEFAULT 'OWN',
    "driverName" TEXT,
    "driverPhone" TEXT,
    "capacity" REAL,
    "capacityUnit" TEXT NOT NULL DEFAULT 'KG',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COURIER',
    "phone" TEXT,
    "email" TEXT,
    "gstNumber" TEXT,
    "ratePerKg" REAL,
    "ratePerKm" REAL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentNumber" TEXT NOT NULL,
    "shipmentType" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "referenceNumber" TEXT,
    "originAddress" TEXT,
    "destinationAddress" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "carrierId" TEXT,
    "vehicleId" TEXT,
    "trackingNumber" TEXT,
    "freightAmount" REAL NOT NULL DEFAULT 0,
    "freightPaidBy" TEXT NOT NULL DEFAULT 'SENDER',
    "weight" REAL,
    "weightUnit" TEXT NOT NULL DEFAULT 'KG',
    "packages" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledDate" DATETIME,
    "readyAt" DATETIME,
    "inTransitAt" DATETIME,
    "outForDeliveryAt" DATETIME,
    "expectedDelivery" DATETIME,
    "deliveredAt" DATETIME,
    "challanNumber" TEXT,
    "ewayBillNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shipment_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Shipment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "unitValue" REAL NOT NULL DEFAULT 0,
    "totalValue" REAL NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "serialNumber" TEXT,
    "notes" TEXT,
    CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoodsReceiptNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grnNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "shipmentId" TEXT,
    "receivedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceNumber" TEXT,
    "invoiceDate" DATETIME,
    "totalValue" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "postedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoodsReceiptNote_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GoodsReceiptNote_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GRNItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grnId" TEXT NOT NULL,
    "productId" TEXT,
    "rawMaterialId" TEXT,
    "itemName" TEXT NOT NULL,
    "orderedQty" REAL,
    "receivedQty" REAL NOT NULL,
    "rejectedQty" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "unitCost" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "expiryDate" DATETIME,
    "notes" TEXT,
    CONSTRAINT "GRNItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryChallan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challanNumber" TEXT NOT NULL,
    "challanType" TEXT NOT NULL DEFAULT 'DELIVERY',
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerAddress" TEXT,
    "shipmentId" TEXT,
    "invoiceId" TEXT,
    "vehicleId" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "dispatchDate" DATETIME,
    "expectedReturn" DATETIME,
    "returnedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalValue" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryChallan_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeliveryChallan_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeliveryChallan_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChallanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challanId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "unitValue" REAL NOT NULL DEFAULT 0,
    "totalValue" REAL NOT NULL DEFAULT 0,
    "returnedQty" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "ChallanItem_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "DeliveryChallan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FreightLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT,
    "carrierId" TEXT,
    "carrierName" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "amount" REAL NOT NULL,
    "paidDate" DATETIME,
    "paidBy" TEXT NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FreightLedger_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FreightLedger_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointmentNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "providerId" TEXT,
    "serviceCatalogId" TEXT,
    "serviceTitle" TEXT NOT NULL,
    "scheduledDate" DATETIME NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "privateNotes" TEXT,
    "cancellationReason" TEXT,
    "invoiceId" TEXT,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "depositPaid" REAL NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "petId" TEXT,
    "chairAssignment" TEXT,
    "services" TEXT,
    "locationId" TEXT,
    CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("appointmentNumber", "cancellationReason", "chairAssignment", "createdAt", "createdBy", "customerId", "customerName", "depositPaid", "durationMinutes", "id", "invoiceId", "locationId", "notes", "petId", "privateNotes", "providerId", "scheduledDate", "scheduledTime", "serviceCatalogId", "serviceTitle", "status", "totalAmount", "updatedAt") SELECT "appointmentNumber", "cancellationReason", "chairAssignment", "createdAt", "createdBy", "customerId", "customerName", "depositPaid", "durationMinutes", "id", "invoiceId", "locationId", "notes", "petId", "privateNotes", "providerId", "scheduledDate", "scheduledTime", "serviceCatalogId", "serviceTitle", "status", "totalAmount", "updatedAt" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE UNIQUE INDEX "Appointment_appointmentNumber_key" ON "Appointment"("appointmentNumber");
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");
CREATE INDEX "Appointment_providerId_idx" ON "Appointment"("providerId");
CREATE INDEX "Appointment_scheduledDate_idx" ON "Appointment"("scheduledDate");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX "Appointment_createdAt_idx" ON "Appointment"("createdAt");
CREATE INDEX "Appointment_petId_idx" ON "Appointment"("petId");
CREATE TABLE "new_Backup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "backupName" TEXT NOT NULL,
    "backupPath" TEXT NOT NULL,
    "backupSize" BIGINT NOT NULL DEFAULT 0,
    "backupDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "backupVersion" TEXT NOT NULL,
    "schemaVersion" TEXT,
    "checksum" TEXT,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Backup" ("backupDate", "backupName", "backupPath", "backupSize", "backupVersion", "checksum", "createdAt", "id", "isValid", "schemaVersion") SELECT "backupDate", "backupName", "backupPath", "backupSize", "backupVersion", "checksum", "createdAt", "id", "isValid", "schemaVersion" FROM "Backup";
DROP TABLE "Backup";
ALTER TABLE "new_Backup" RENAME TO "Backup";
CREATE TABLE "new_CancellationPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noticePeriodHours" INTEGER NOT NULL DEFAULT 24,
    "cancellationFeeType" TEXT NOT NULL DEFAULT 'NONE',
    "cancellationFeeValue" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CancellationPolicy" ("cancellationFeeType", "cancellationFeeValue", "createdAt", "id", "isActive", "notes", "noticePeriodHours", "updatedAt") SELECT "cancellationFeeType", "cancellationFeeValue", "createdAt", "id", "isActive", "notes", "noticePeriodHours", "updatedAt" FROM "CancellationPolicy";
DROP TABLE "CancellationPolicy";
ALTER TABLE "new_CancellationPolicy" RENAME TO "CancellationPolicy";
CREATE TABLE "new_CarJobCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleMake" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "vehicleYear" INTEGER,
    "vehicleType" TEXT NOT NULL DEFAULT '4W',
    "kmIn" INTEGER,
    "kmOut" INTEGER,
    "serviceAdvisorId" TEXT,
    "technicianIds" TEXT NOT NULL DEFAULT '[]',
    "serviceItems" TEXT NOT NULL DEFAULT '[]',
    "partsItems" TEXT NOT NULL DEFAULT '[]',
    "laborTotal" DECIMAL NOT NULL DEFAULT 0,
    "partsTotal" DECIMAL NOT NULL DEFAULT 0,
    "estimatedDelivery" DATETIME,
    "deliveredDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "invoiceId" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CarJobCard_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CarJobCard_serviceAdvisorId_fkey" FOREIGN KEY ("serviceAdvisorId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CarJobCard" ("clientId", "createdAt", "deliveredDate", "estimatedDelivery", "id", "internalNotes", "invoiceId", "jobNumber", "kmIn", "kmOut", "laborTotal", "notes", "partsItems", "partsTotal", "serviceAdvisorId", "serviceItems", "status", "technicianIds", "updatedAt", "vehicleMake", "vehicleModel", "vehicleNumber", "vehicleType", "vehicleYear") SELECT "clientId", "createdAt", "deliveredDate", "estimatedDelivery", "id", "internalNotes", "invoiceId", "jobNumber", "kmIn", "kmOut", "laborTotal", "notes", "partsItems", "partsTotal", "serviceAdvisorId", "serviceItems", "status", "technicianIds", "updatedAt", "vehicleMake", "vehicleModel", "vehicleNumber", "vehicleType", "vehicleYear" FROM "CarJobCard";
DROP TABLE "CarJobCard";
ALTER TABLE "new_CarJobCard" RENAME TO "CarJobCard";
CREATE UNIQUE INDEX "CarJobCard_jobNumber_key" ON "CarJobCard"("jobNumber");
CREATE INDEX "CarJobCard_clientId_idx" ON "CarJobCard"("clientId");
CREATE INDEX "CarJobCard_status_idx" ON "CarJobCard"("status");
CREATE INDEX "CarJobCard_vehicleNumber_idx" ON "CarJobCard"("vehicleNumber");
CREATE INDEX "CarJobCard_createdAt_idx" ON "CarJobCard"("createdAt");
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "expenseName" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "expenseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "categoryId", "createdAt", "createdById", "expenseDate", "expenseName", "id", "paymentMethod", "remarks") SELECT "amount", "categoryId", "createdAt", "createdById", "expenseDate", "expenseName", "id", "paymentMethod", "remarks" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" TEXT NOT NULL DEFAULT 'RETAIL',
    "customerId" TEXT,
    "invoiceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "roundingAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "balanceAmount" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "gstType" TEXT NOT NULL DEFAULT 'CGST_SGST',
    "buyerState" TEXT,
    "notes" TEXT,
    "quotationId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("balanceAmount", "createdAt", "createdById", "customerId", "discountAmount", "dueDate", "id", "invoiceDate", "invoiceNumber", "invoiceType", "notes", "paidAmount", "paymentStatus", "roundingAmount", "status", "subtotal", "taxAmount", "totalAmount", "updatedAt") SELECT "balanceAmount", "createdAt", "createdById", "customerId", "discountAmount", "dueDate", "id", "invoiceDate", "invoiceNumber", "invoiceType", "notes", "paidAmount", "paymentStatus", "roundingAmount", "status", "subtotal", "taxAmount", "totalAmount", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_quotationId_key" ON "Invoice"("quotationId");
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_status_invoiceDate_idx" ON "Invoice"("status", "invoiceDate");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");
CREATE INDEX "Invoice_createdById_idx" ON "Invoice"("createdById");
CREATE TABLE "new_InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL DEFAULT '',
    "productSku" TEXT,
    "hsnCode" TEXT,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "lineTotal" REAL NOT NULL,
    "variantId" TEXT,
    "variantInfo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceItem" ("createdAt", "discountAmount", "id", "invoiceId", "lineTotal", "productId", "quantity", "taxAmount", "taxRate", "unitPrice", "variantId", "variantInfo") SELECT "createdAt", "discountAmount", "id", "invoiceId", "lineTotal", "productId", "quantity", "taxAmount", "taxRate", "unitPrice", "variantId", "variantInfo" FROM "InvoiceItem";
DROP TABLE "InvoiceItem";
ALTER TABLE "new_InvoiceItem" RENAME TO "InvoiceItem";
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_productId_idx" ON "InvoiceItem"("productId");
CREATE TABLE "new_LeaveRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "fromDate" DATETIME NOT NULL,
    "toDate" DATETIME NOT NULL,
    "days" REAL NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LeaveRequest" ("approvedAt", "approvedBy", "createdAt", "days", "employeeId", "fromDate", "id", "leaveTypeId", "notes", "reason", "status", "toDate", "updatedAt") SELECT "approvedAt", "approvedBy", "createdAt", "days", "employeeId", "fromDate", "id", "leaveTypeId", "notes", "reason", "status", "toDate", "updatedAt" FROM "LeaveRequest";
DROP TABLE "LeaveRequest";
ALTER TABLE "new_LeaveRequest" RENAME TO "LeaveRequest";
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");
CREATE INDEX "LeaveRequest_leaveTypeId_idx" ON "LeaveRequest"("leaveTypeId");
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");
CREATE INDEX "LeaveRequest_fromDate_idx" ON "LeaveRequest"("fromDate");
CREATE TABLE "new_MeasurementRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "chest" DECIMAL,
    "waist" DECIMAL,
    "hips" DECIMAL,
    "shoulder" DECIMAL,
    "neck" DECIMAL,
    "sleeve" DECIMAL,
    "inseam" DECIMAL,
    "outseam" DECIMAL,
    "thigh" DECIMAL,
    "height" DECIMAL,
    "notes" TEXT,
    "takenById" TEXT,
    "recordDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MeasurementRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeasurementRecord_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MeasurementRecord" ("chest", "clientId", "createdAt", "height", "hips", "id", "inseam", "neck", "notes", "outseam", "recordDate", "shoulder", "sleeve", "takenById", "thigh", "updatedAt", "waist") SELECT "chest", "clientId", "createdAt", "height", "hips", "id", "inseam", "neck", "notes", "outseam", "recordDate", "shoulder", "sleeve", "takenById", "thigh", "updatedAt", "waist" FROM "MeasurementRecord";
DROP TABLE "MeasurementRecord";
ALTER TABLE "new_MeasurementRecord" RENAME TO "MeasurementRecord";
CREATE INDEX "MeasurementRecord_clientId_idx" ON "MeasurementRecord"("clientId");
CREATE INDEX "MeasurementRecord_recordDate_idx" ON "MeasurementRecord"("recordDate");
CREATE TABLE "new_NotificationQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointmentId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "notificationType" TEXT NOT NULL,
    "templateBody" TEXT NOT NULL,
    "whatsappLink" TEXT,
    "scheduledFor" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_NotificationQueue" ("appointmentId", "createdAt", "customerId", "customerName", "customerPhone", "id", "notificationType", "scheduledFor", "sentAt", "status", "templateBody", "updatedAt", "whatsappLink") SELECT "appointmentId", "createdAt", "customerId", "customerName", "customerPhone", "id", "notificationType", "scheduledFor", "sentAt", "status", "templateBody", "updatedAt", "whatsappLink" FROM "NotificationQueue";
DROP TABLE "NotificationQueue";
ALTER TABLE "new_NotificationQueue" RENAME TO "NotificationQueue";
CREATE INDEX "NotificationQueue_status_idx" ON "NotificationQueue"("status");
CREATE INDEX "NotificationQueue_appointmentId_idx" ON "NotificationQueue"("appointmentId");
CREATE INDEX "NotificationQueue_customerId_idx" ON "NotificationQueue"("customerId");
CREATE INDEX "NotificationQueue_scheduledFor_idx" ON "NotificationQueue"("scheduledFor");
CREATE TABLE "new_PestJobSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobNumber" TEXT NOT NULL,
    "contractId" TEXT,
    "clientId" TEXT NOT NULL,
    "visitDate" DATETIME NOT NULL,
    "scheduledTime" TEXT,
    "technicianIds" TEXT NOT NULL DEFAULT '[]',
    "pesticideUsed" TEXT,
    "areasServiced" TEXT NOT NULL DEFAULT '[]',
    "treatmentType" TEXT NOT NULL DEFAULT 'SPRAY',
    "jobAmount" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "completedDate" DATETIME,
    "followUpDate" DATETIME,
    "clientSignature" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PestJobSheet_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "PestServiceContract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PestJobSheet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PestJobSheet" ("areasServiced", "clientId", "clientSignature", "completedDate", "contractId", "createdAt", "followUpDate", "id", "invoiceId", "jobAmount", "jobNumber", "notes", "pesticideUsed", "scheduledTime", "status", "technicianIds", "treatmentType", "updatedAt", "visitDate") SELECT "areasServiced", "clientId", "clientSignature", "completedDate", "contractId", "createdAt", "followUpDate", "id", "invoiceId", "jobAmount", "jobNumber", "notes", "pesticideUsed", "scheduledTime", "status", "technicianIds", "treatmentType", "updatedAt", "visitDate" FROM "PestJobSheet";
DROP TABLE "PestJobSheet";
ALTER TABLE "new_PestJobSheet" RENAME TO "PestJobSheet";
CREATE UNIQUE INDEX "PestJobSheet_jobNumber_key" ON "PestJobSheet"("jobNumber");
CREATE INDEX "PestJobSheet_contractId_idx" ON "PestJobSheet"("contractId");
CREATE INDEX "PestJobSheet_clientId_idx" ON "PestJobSheet"("clientId");
CREATE INDEX "PestJobSheet_status_idx" ON "PestJobSheet"("status");
CREATE INDEX "PestJobSheet_visitDate_idx" ON "PestJobSheet"("visitDate");
CREATE TABLE "new_PestServiceContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    "pestTypes" TEXT NOT NULL DEFAULT '[]',
    "serviceFrequency" TEXT NOT NULL DEFAULT 'QUARTERLY',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "contractValue" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedToId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PestServiceContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PestServiceContract_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PestServiceContract" ("assignedToId", "clientId", "contractNumber", "contractValue", "createdAt", "endDate", "id", "notes", "pestTypes", "propertyAddress", "propertyType", "serviceFrequency", "startDate", "status", "updatedAt") SELECT "assignedToId", "clientId", "contractNumber", "contractValue", "createdAt", "endDate", "id", "notes", "pestTypes", "propertyAddress", "propertyType", "serviceFrequency", "startDate", "status", "updatedAt" FROM "PestServiceContract";
DROP TABLE "PestServiceContract";
ALTER TABLE "new_PestServiceContract" RENAME TO "PestServiceContract";
CREATE UNIQUE INDEX "PestServiceContract_contractNumber_key" ON "PestServiceContract"("contractNumber");
CREATE INDEX "PestServiceContract_clientId_idx" ON "PestServiceContract"("clientId");
CREATE INDEX "PestServiceContract_status_idx" ON "PestServiceContract"("status");
CREATE INDEX "PestServiceContract_assignedToId_idx" ON "PestServiceContract"("assignedToId");
CREATE TABLE "new_Pet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "petName" TEXT NOT NULL,
    "species" TEXT NOT NULL DEFAULT 'Dog',
    "breed" TEXT,
    "dateOfBirth" DATETIME,
    "gender" TEXT,
    "color" TEXT,
    "weight" REAL,
    "microchipId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "photoPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pet_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Pet" ("breed", "color", "createdAt", "customerId", "dateOfBirth", "gender", "id", "isActive", "microchipId", "notes", "petName", "photoPath", "species", "updatedAt", "weight") SELECT "breed", "color", "createdAt", "customerId", "dateOfBirth", "gender", "id", "isActive", "microchipId", "notes", "petName", "photoPath", "species", "updatedAt", "weight" FROM "Pet";
DROP TABLE "Pet";
ALTER TABLE "new_Pet" RENAME TO "Pet";
CREATE INDEX "Pet_customerId_idx" ON "Pet"("customerId");
CREATE INDEX "Pet_species_idx" ON "Pet"("species");
CREATE INDEX "Pet_isActive_idx" ON "Pet"("isActive");
CREATE TABLE "new_ProviderSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isWorking" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProviderSchedule_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProviderSchedule" ("breakEnd", "breakStart", "createdAt", "dayOfWeek", "endTime", "id", "isWorking", "providerId", "slotDuration", "startTime", "updatedAt") SELECT "breakEnd", "breakStart", "createdAt", "dayOfWeek", "endTime", "id", "isWorking", "providerId", "slotDuration", "startTime", "updatedAt" FROM "ProviderSchedule";
DROP TABLE "ProviderSchedule";
ALTER TABLE "new_ProviderSchedule" RENAME TO "ProviderSchedule";
CREATE INDEX "ProviderSchedule_providerId_idx" ON "ProviderSchedule"("providerId");
CREATE UNIQUE INDEX "ProviderSchedule_providerId_dayOfWeek_key" ON "ProviderSchedule"("providerId", "dayOfWeek");
CREATE TABLE "new_PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitCost" REAL NOT NULL,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "itcAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedQty" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrderItem" ("createdAt", "id", "productId", "purchaseOrderId", "quantity", "taxRate", "total", "unitCost") SELECT "createdAt", "id", "productId", "purchaseOrderId", "quantity", "taxRate", "total", "unitCost" FROM "PurchaseOrderItem";
DROP TABLE "PurchaseOrderItem";
ALTER TABLE "new_PurchaseOrderItem" RENAME TO "PurchaseOrderItem";
CREATE TABLE "new_RawMaterialMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rawMaterialId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL DEFAULT 0,
    "reference" TEXT,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawMaterialMovement_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RawMaterialMovement" ("balanceAfter", "createdAt", "createdById", "id", "notes", "quantity", "rawMaterialId", "reference", "type", "unitCost") SELECT "balanceAfter", "createdAt", "createdById", "id", "notes", "quantity", "rawMaterialId", "reference", "type", "unitCost" FROM "RawMaterialMovement";
DROP TABLE "RawMaterialMovement";
ALTER TABLE "new_RawMaterialMovement" RENAME TO "RawMaterialMovement";
CREATE INDEX "RawMaterialMovement_rawMaterialId_idx" ON "RawMaterialMovement"("rawMaterialId");
CREATE INDEX "RawMaterialMovement_type_idx" ON "RawMaterialMovement"("type");
CREATE INDEX "RawMaterialMovement_createdAt_idx" ON "RawMaterialMovement"("createdAt");
CREATE TABLE "new_ServiceCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceName" TEXT NOT NULL,
    "serviceCode" TEXT,
    "category" TEXT,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "basePrice" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "sacCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "locationId" TEXT
);
INSERT INTO "new_ServiceCatalog" ("basePrice", "category", "createdAt", "description", "durationMinutes", "id", "isActive", "locationId", "notes", "sacCode", "serviceCode", "serviceName", "taxRate", "updatedAt") SELECT "basePrice", "category", "createdAt", "description", "durationMinutes", "id", "isActive", "locationId", "notes", "sacCode", "serviceCode", "serviceName", "taxRate", "updatedAt" FROM "ServiceCatalog";
DROP TABLE "ServiceCatalog";
ALTER TABLE "new_ServiceCatalog" RENAME TO "ServiceCatalog";
CREATE UNIQUE INDEX "ServiceCatalog_serviceCode_key" ON "ServiceCatalog"("serviceCode");
CREATE INDEX "ServiceCatalog_isActive_idx" ON "ServiceCatalog"("isActive");
CREATE INDEX "ServiceCatalog_category_idx" ON "ServiceCatalog"("category");
CREATE INDEX "ServiceCatalog_serviceName_idx" ON "ServiceCatalog"("serviceName");
CREATE TABLE "new_TailoringOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "measurementRecordId" TEXT,
    "garmentType" TEXT NOT NULL,
    "fabricDescription" TEXT,
    "fabricSupplied" TEXT NOT NULL DEFAULT 'CLIENT',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL NOT NULL DEFAULT 0,
    "advancePaid" DECIMAL NOT NULL DEFAULT 0,
    "trialDate" DATETIME,
    "deliveryDate" DATETIME,
    "deliveredDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "assignedToId" TEXT,
    "invoiceId" TEXT,
    "specialInstructions" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TailoringOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TailoringOrder_measurementRecordId_fkey" FOREIGN KEY ("measurementRecordId") REFERENCES "MeasurementRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TailoringOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TailoringOrder" ("advancePaid", "assignedToId", "clientId", "createdAt", "deliveredDate", "deliveryDate", "fabricDescription", "fabricSupplied", "garmentType", "id", "invoiceId", "measurementRecordId", "notes", "orderNumber", "quantity", "specialInstructions", "status", "totalAmount", "trialDate", "unitPrice", "updatedAt") SELECT "advancePaid", "assignedToId", "clientId", "createdAt", "deliveredDate", "deliveryDate", "fabricDescription", "fabricSupplied", "garmentType", "id", "invoiceId", "measurementRecordId", "notes", "orderNumber", "quantity", "specialInstructions", "status", "totalAmount", "trialDate", "unitPrice", "updatedAt" FROM "TailoringOrder";
DROP TABLE "TailoringOrder";
ALTER TABLE "new_TailoringOrder" RENAME TO "TailoringOrder";
CREATE UNIQUE INDEX "TailoringOrder_orderNumber_key" ON "TailoringOrder"("orderNumber");
CREATE INDEX "TailoringOrder_clientId_idx" ON "TailoringOrder"("clientId");
CREATE INDEX "TailoringOrder_status_idx" ON "TailoringOrder"("status");
CREATE INDEX "TailoringOrder_deliveryDate_idx" ON "TailoringOrder"("deliveryDate");
CREATE INDEX "TailoringOrder_createdAt_idx" ON "TailoringOrder"("createdAt");
CREATE TABLE "new_TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT,
    "caseId" TEXT,
    "projectId" TEXT,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "hours" DECIMAL NOT NULL,
    "ratePerHour" DECIMAL NOT NULL DEFAULT 0,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "isBilled" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ServiceProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TimeEntry" ("amount", "caseId", "createdAt", "date", "description", "employeeId", "hours", "id", "invoiceId", "isBilled", "projectId", "ratePerHour", "updatedAt") SELECT "amount", "caseId", "createdAt", "date", "description", "employeeId", "hours", "id", "invoiceId", "isBilled", "projectId", "ratePerHour", "updatedAt" FROM "TimeEntry";
DROP TABLE "TimeEntry";
ALTER TABLE "new_TimeEntry" RENAME TO "TimeEntry";
CREATE INDEX "TimeEntry_employeeId_idx" ON "TimeEntry"("employeeId");
CREATE INDEX "TimeEntry_caseId_idx" ON "TimeEntry"("caseId");
CREATE INDEX "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");
CREATE INDEX "TimeEntry_date_idx" ON "TimeEntry"("date");
CREATE INDEX "TimeEntry_isBilled_idx" ON "TimeEntry"("isBilled");
CREATE TABLE "new_VaccinationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "petId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "vaccineType" TEXT,
    "batchNumber" TEXT,
    "manufacturer" TEXT,
    "administeredAt" DATETIME NOT NULL,
    "administeredBy" TEXT,
    "nextDueDate" DATETIME,
    "notes" TEXT,
    "certificatePrinted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VaccinationRecord_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VaccinationRecord" ("administeredAt", "administeredBy", "batchNumber", "certificatePrinted", "createdAt", "id", "manufacturer", "nextDueDate", "notes", "petId", "updatedAt", "vaccineName", "vaccineType") SELECT "administeredAt", "administeredBy", "batchNumber", "certificatePrinted", "createdAt", "id", "manufacturer", "nextDueDate", "notes", "petId", "updatedAt", "vaccineName", "vaccineType" FROM "VaccinationRecord";
DROP TABLE "VaccinationRecord";
ALTER TABLE "new_VaccinationRecord" RENAME TO "VaccinationRecord";
CREATE INDEX "VaccinationRecord_petId_idx" ON "VaccinationRecord"("petId");
CREATE INDEX "VaccinationRecord_nextDueDate_idx" ON "VaccinationRecord"("nextDueDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DailyCashClose_closeDate_idx" ON "DailyCashClose"("closeDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCashClose_closeDate_key" ON "DailyCashClose"("closeDate");

-- CreateIndex
CREATE INDEX "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quotationNumber_key" ON "Quotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_createdAt_idx" ON "Quotation"("createdAt");

-- CreateIndex
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON "CreditNote"("creditNoteNumber");

-- CreateIndex
CREATE INDEX "CreditNote_customerId_idx" ON "CreditNote"("customerId");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "CreditNote_createdAt_idx" ON "CreditNote"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DebitNote_debitNoteNumber_key" ON "DebitNote"("debitNoteNumber");

-- CreateIndex
CREATE INDEX "DebitNote_supplierId_idx" ON "DebitNote"("supplierId");

-- CreateIndex
CREATE INDEX "DebitNote_purchaseOrderId_idx" ON "DebitNote"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "DebitNote_createdAt_idx" ON "DebitNote"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_candidateNumber_key" ON "Candidate"("candidateNumber");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE INDEX "Candidate_createdAt_idx" ON "Candidate"("createdAt");

-- CreateIndex
CREATE INDEX "Candidate_fullName_idx" ON "Candidate"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "JobOrder_orderNumber_key" ON "JobOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "JobOrder_clientId_idx" ON "JobOrder"("clientId");

-- CreateIndex
CREATE INDEX "JobOrder_status_idx" ON "JobOrder"("status");

-- CreateIndex
CREATE INDEX "JobOrder_createdAt_idx" ON "JobOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Placement_placementNumber_key" ON "Placement"("placementNumber");

-- CreateIndex
CREATE INDEX "Placement_candidateId_idx" ON "Placement"("candidateId");

-- CreateIndex
CREATE INDEX "Placement_jobOrderId_idx" ON "Placement"("jobOrderId");

-- CreateIndex
CREATE INDEX "Placement_clientId_idx" ON "Placement"("clientId");

-- CreateIndex
CREATE INDEX "Placement_status_idx" ON "Placement"("status");

-- CreateIndex
CREATE INDEX "Placement_joiningDate_idx" ON "Placement"("joiningDate");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vehicleNumber_key" ON "Vehicle"("vehicleNumber");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_name_key" ON "Carrier"("name");

-- CreateIndex
CREATE INDEX "Carrier_isActive_idx" ON "Carrier"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentNumber_key" ON "Shipment"("shipmentNumber");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_carrierId_idx" ON "Shipment"("carrierId");

-- CreateIndex
CREATE INDEX "Shipment_vehicleId_idx" ON "Shipment"("vehicleId");

-- CreateIndex
CREATE INDEX "Shipment_scheduledDate_idx" ON "Shipment"("scheduledDate");

-- CreateIndex
CREATE INDEX "Shipment_createdAt_idx" ON "Shipment"("createdAt");

-- CreateIndex
CREATE INDEX "ShipmentItem_shipmentId_idx" ON "ShipmentItem"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptNote_grnNumber_key" ON "GoodsReceiptNote"("grnNumber");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_purchaseOrderId_idx" ON "GoodsReceiptNote"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_status_idx" ON "GoodsReceiptNote"("status");

-- CreateIndex
CREATE INDEX "GoodsReceiptNote_receivedDate_idx" ON "GoodsReceiptNote"("receivedDate");

-- CreateIndex
CREATE INDEX "GRNItem_grnId_idx" ON "GRNItem"("grnId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallan_challanNumber_key" ON "DeliveryChallan"("challanNumber");

-- CreateIndex
CREATE INDEX "DeliveryChallan_status_idx" ON "DeliveryChallan"("status");

-- CreateIndex
CREATE INDEX "DeliveryChallan_invoiceId_idx" ON "DeliveryChallan"("invoiceId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_shipmentId_idx" ON "DeliveryChallan"("shipmentId");

-- CreateIndex
CREATE INDEX "ChallanItem_challanId_idx" ON "ChallanItem"("challanId");

-- CreateIndex
CREATE INDEX "FreightLedger_carrierId_idx" ON "FreightLedger"("carrierId");

-- CreateIndex
CREATE INDEX "FreightLedger_paidDate_idx" ON "FreightLedger"("paidDate");

-- CreateIndex
CREATE INDEX "FreightLedger_createdAt_idx" ON "FreightLedger"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "Customer_customerName_idx" ON "Customer"("customerName");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");

-- CreateIndex
CREATE INDEX "CustomerLedger_customerId_idx" ON "CustomerLedger"("customerId");

-- CreateIndex
CREATE INDEX "CustomerLedger_createdAt_idx" ON "CustomerLedger"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_movementType_idx" ON "InventoryMovement"("movementType");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "Payment_isReversed_idx" ON "Payment"("isReversed");

-- CreateIndex
CREATE INDEX "Product_productName_idx" ON "Product"("productName");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "SupplierLedger_supplierId_idx" ON "SupplierLedger"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierLedger_createdAt_idx" ON "SupplierLedger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxConfiguration_taxName_taxType_key" ON "TaxConfiguration"("taxName", "taxType");

-- CreateIndex
CREATE UNIQUE INDEX "User_sessionToken_key" ON "User"("sessionToken");

-- NOTE: Prisma's diff wanted to rename sqlite_autoindex_* -> named unique
-- indexes on DeliveryTracker, DrivingVehicle, LearnerProfile, StudentProfile,
-- TokenQueue, VisitNote. SQLite refuses to DROP an autoindex backing an
-- inline column UNIQUE constraint ("index associated with UNIQUE or PRIMARY
-- KEY constraint cannot be dropped"). The constraint itself already exists
-- and is enforced (verified via PRAGMA index_list) -- purely cosmetic, so
-- these six RedefineIndex pairs are intentionally omitted.
