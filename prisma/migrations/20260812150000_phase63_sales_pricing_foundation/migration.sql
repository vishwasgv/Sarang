-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN "defaultInvoiceTemplateId" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN "retainerType" TEXT;

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "soNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceDescription" TEXT,
    "serviceCategoryId" TEXT,
    "quantity" REAL NOT NULL,
    "invoicedQty" REAL NOT NULL DEFAULT 0,
    "unitPrice" REAL NOT NULL,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalesOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalesOrderItem_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "cadence" TEXT NOT NULL DEFAULT 'MONTHLY',
    "dayOfPeriod" INTEGER NOT NULL DEFAULT 1,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "lastGeneratedPeriod" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecurringProfile_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecurringProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minQuantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL,
    CONSTRAINT "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PriceListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingScheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "productId" TEXT,
    "categoryId" TEXT,
    "buyQuantity" REAL,
    "freeQuantity" REAL,
    "slabBreakpoints" TEXT NOT NULL DEFAULT '[]',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PricingScheme_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PricingScheme_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "approverRoleId" TEXT,
    "approverUserId" TEXT,
    "minAmountThreshold" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ApprovalStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalStep_approverRoleId_fkey" FOREIGN KEY ("approverRoleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalStep_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "purchaseOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApprovalInstance_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalInstance_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalInstance_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "actionById" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "actionedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalAction_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ApprovalInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalAction_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ApprovalStep" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalAction_actionById_fkey" FOREIGN KEY ("actionById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditNoteItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creditNoteId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceDescription" TEXT,
    "serviceCategoryId" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "lineTotal" REAL NOT NULL,
    CONSTRAINT "CreditNoteItem_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreditNoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CreditNoteItem_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DebitNoteItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debitNoteId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceDescription" TEXT,
    "serviceCategoryId" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "lineTotal" REAL NOT NULL,
    CONSTRAINT "DebitNoteItem_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "DebitNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DebitNoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DebitNoteItem_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerCode" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "taxNumber" TEXT,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "taxExemptReason" TEXT,
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "outstandingBalance" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "customerClass" TEXT,
    "lastAgmDate" DATETIME,
    "customerKind" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "companyRegistrationNumber" TEXT,
    "contactPersonName" TEXT,
    "idProofType" TEXT,
    "idProofNumber" TEXT,
    "priceListId" TEXT,
    CONSTRAINT "Customer_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("address", "city", "companyRegistrationNumber", "contactPersonName", "country", "createdAt", "creditLimit", "customerClass", "customerCode", "customerKind", "customerName", "email", "id", "idProofNumber", "idProofType", "isActive", "lastAgmDate", "notes", "outstandingBalance", "phone", "state", "taxExempt", "taxExemptReason", "taxNumber", "updatedAt") SELECT "address", "city", "companyRegistrationNumber", "contactPersonName", "country", "createdAt", "creditLimit", "customerClass", "customerCode", "customerKind", "customerName", "email", "id", "idProofNumber", "idProofType", "isActive", "lastAgmDate", "notes", "outstandingBalance", "phone", "state", "taxExempt", "taxExemptReason", "taxNumber", "updatedAt" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode");
CREATE INDEX "Customer_customerName_idx" ON "Customer"("customerName");
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");
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
    "originalInvoiceId" TEXT,
    "tableId" TEXT,
    "splitFromInvoiceId" TEXT,
    "ewayBillNumber" TEXT,
    "salesOrderId" TEXT,
    "invoiceTemplateId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_splitFromInvoiceId_fkey" FOREIGN KEY ("splitFromInvoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_invoiceTemplateId_fkey" FOREIGN KEY ("invoiceTemplateId") REFERENCES "InvoiceTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("balanceAmount", "buyerState", "createdAt", "createdById", "customerId", "discountAmount", "dueDate", "ewayBillNumber", "gstType", "id", "invoiceDate", "invoiceNumber", "invoiceType", "notes", "originalInvoiceId", "paidAmount", "paymentStatus", "quotationId", "roundingAmount", "splitFromInvoiceId", "status", "subtotal", "tableId", "taxAmount", "totalAmount", "updatedAt") SELECT "balanceAmount", "buyerState", "createdAt", "createdById", "customerId", "discountAmount", "dueDate", "ewayBillNumber", "gstType", "id", "invoiceDate", "invoiceNumber", "invoiceType", "notes", "originalInvoiceId", "paidAmount", "paymentStatus", "quotationId", "roundingAmount", "splitFromInvoiceId", "status", "subtotal", "tableId", "taxAmount", "totalAmount", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_quotationId_key" ON "Invoice"("quotationId");
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE INDEX "Invoice_salesOrderId_idx" ON "Invoice"("salesOrderId");
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_status_invoiceDate_idx" ON "Invoice"("status", "invoiceDate");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");
CREATE INDEX "Invoice_createdById_idx" ON "Invoice"("createdById");
CREATE INDEX "Invoice_originalInvoiceId_idx" ON "Invoice"("originalInvoiceId");
CREATE INDEX "Invoice_tableId_idx" ON "Invoice"("tableId");
CREATE INDEX "Invoice_splitFromInvoiceId_idx" ON "Invoice"("splitFromInvoiceId");
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
    "weightUnit" TEXT,
    "jewelleryMetalType" TEXT,
    "jewelleryPurity" TEXT,
    "jewelleryNetWeight" REAL,
    "jewelleryRatePerGram" REAL,
    "jewelleryMakingCharge" REAL,
    "jewelleryHallmarkNumber" TEXT,
    "prescriptionPatientName" TEXT,
    "prescriptionDoctorName" TEXT,
    "prescriptionDate" DATETIME,
    "isFreeOfCost" BOOLEAN NOT NULL DEFAULT false,
    "schemeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "PricingScheme" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceItem" ("createdAt", "discountAmount", "hsnCode", "id", "invoiceId", "jewelleryHallmarkNumber", "jewelleryMakingCharge", "jewelleryMetalType", "jewelleryNetWeight", "jewelleryPurity", "jewelleryRatePerGram", "lineTotal", "prescriptionDate", "prescriptionDoctorName", "prescriptionPatientName", "productId", "productName", "productSku", "quantity", "taxAmount", "taxRate", "unitPrice", "variantId", "variantInfo", "weightUnit") SELECT "createdAt", "discountAmount", "hsnCode", "id", "invoiceId", "jewelleryHallmarkNumber", "jewelleryMakingCharge", "jewelleryMetalType", "jewelleryNetWeight", "jewelleryPurity", "jewelleryRatePerGram", "lineTotal", "prescriptionDate", "prescriptionDoctorName", "prescriptionPatientName", "productId", "productName", "productSku", "quantity", "taxAmount", "taxRate", "unitPrice", "variantId", "variantInfo", "weightUnit" FROM "InvoiceItem";
DROP TABLE "InvoiceItem";
ALTER TABLE "new_InvoiceItem" RENAME TO "InvoiceItem";
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_productId_idx" ON "InvoiceItem"("productId");
CREATE INDEX "InvoiceItem_schemeId_idx" ON "InvoiceItem"("schemeId");
CREATE TABLE "new_PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "dropShipToCustomerId" TEXT,
    "sourceSalesOrderId" TEXT,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_dropShipToCustomerId_fkey" FOREIGN KEY ("dropShipToCustomerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_sourceSalesOrderId_fkey" FOREIGN KEY ("sourceSalesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrder" ("createdAt", "createdById", "expectedDate", "id", "isReverseCharge", "notes", "orderDate", "poNumber", "status", "subtotal", "supplierId", "taxAmount", "totalAmount", "updatedAt") SELECT "createdAt", "createdById", "expectedDate", "id", "isReverseCharge", "notes", "orderDate", "poNumber", "status", "subtotal", "supplierId", "taxAmount", "totalAmount", "updatedAt" FROM "PurchaseOrder";
DROP TABLE "PurchaseOrder";
ALTER TABLE "new_PurchaseOrder" RENAME TO "PurchaseOrder";
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");
CREATE TABLE "new_ServiceProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "projectType" TEXT NOT NULL DEFAULT 'GENERAL',
    "stage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalContractValue" DECIMAL,
    "startDate" DATETIME,
    "expectedEndDate" DATETIME,
    "completedDate" DATETIME,
    "assignedToId" TEXT,
    "notes" TEXT,
    "targetChannel" TEXT,
    "deliverableType" TEXT,
    "adSpendBudget" DECIMAL,
    "billingMethod" TEXT NOT NULL DEFAULT 'FIXED_COST',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceProject_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceProject_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceProject" ("adSpendBudget", "assignedToId", "clientId", "completedDate", "createdAt", "deliverableType", "expectedEndDate", "id", "notes", "projectName", "projectType", "stage", "startDate", "status", "targetChannel", "totalContractValue", "updatedAt") SELECT "adSpendBudget", "assignedToId", "clientId", "completedDate", "createdAt", "deliverableType", "expectedEndDate", "id", "notes", "projectName", "projectType", "stage", "startDate", "status", "targetChannel", "totalContractValue", "updatedAt" FROM "ServiceProject";
DROP TABLE "ServiceProject";
ALTER TABLE "new_ServiceProject" RENAME TO "ServiceProject";
CREATE INDEX "ServiceProject_clientId_idx" ON "ServiceProject"("clientId");
CREATE INDEX "ServiceProject_status_idx" ON "ServiceProject"("status");
CREATE INDEX "ServiceProject_assignedToId_idx" ON "ServiceProject"("assignedToId");
CREATE TABLE "new_Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierCode" TEXT,
    "supplierName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "taxNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "bankAccountNumber" TEXT,
    "bankIfscCode" TEXT,
    "bankName" TEXT,
    "panNumber" TEXT,
    "openingBalance" REAL NOT NULL DEFAULT 0,
    "isMsmeRegistered" BOOLEAN NOT NULL DEFAULT false,
    "msmeCategory" TEXT,
    "priceListId" TEXT,
    CONSTRAINT "Supplier_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Supplier" ("address", "bankAccountNumber", "bankIfscCode", "bankName", "city", "country", "createdAt", "email", "id", "isActive", "isMsmeRegistered", "msmeCategory", "notes", "openingBalance", "panNumber", "phone", "state", "supplierCode", "supplierName", "taxNumber", "updatedAt") SELECT "address", "bankAccountNumber", "bankIfscCode", "bankName", "city", "country", "createdAt", "email", "id", "isActive", "isMsmeRegistered", "msmeCategory", "notes", "openingBalance", "panNumber", "phone", "state", "supplierCode", "supplierName", "taxNumber", "updatedAt" FROM "Supplier";
DROP TABLE "Supplier";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
CREATE UNIQUE INDEX "Supplier_supplierCode_key" ON "Supplier"("supplierCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_soNumber_key" ON "SalesOrder"("soNumber");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE INDEX "SalesOrder_orderDate_idx" ON "SalesOrder"("orderDate");

-- CreateIndex
CREATE INDEX "SalesOrderItem_salesOrderId_idx" ON "SalesOrderItem"("salesOrderId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_serviceCategoryId_idx" ON "SalesOrderItem"("serviceCategoryId");

-- CreateIndex
CREATE INDEX "RecurringProfile_documentType_idx" ON "RecurringProfile"("documentType");

-- CreateIndex
CREATE INDEX "RecurringProfile_active_idx" ON "RecurringProfile"("active");

-- CreateIndex
CREATE INDEX "RecurringProfile_customerId_idx" ON "RecurringProfile"("customerId");

-- CreateIndex
CREATE INDEX "RecurringProfile_supplierId_idx" ON "RecurringProfile"("supplierId");

-- CreateIndex
CREATE INDEX "PriceList_appliesTo_idx" ON "PriceList"("appliesTo");

-- CreateIndex
CREATE INDEX "PriceList_isActive_idx" ON "PriceList"("isActive");

-- CreateIndex
CREATE INDEX "PriceListItem_priceListId_idx" ON "PriceListItem"("priceListId");

-- CreateIndex
CREATE INDEX "PriceListItem_productId_idx" ON "PriceListItem"("productId");

-- CreateIndex
CREATE INDEX "PricingScheme_isActive_idx" ON "PricingScheme"("isActive");

-- CreateIndex
CREATE INDEX "PricingScheme_productId_idx" ON "PricingScheme"("productId");

-- CreateIndex
CREATE INDEX "PricingScheme_categoryId_idx" ON "PricingScheme"("categoryId");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_documentType_idx" ON "ApprovalWorkflow"("documentType");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_isActive_idx" ON "ApprovalWorkflow"("isActive");

-- CreateIndex
CREATE INDEX "ApprovalStep_workflowId_idx" ON "ApprovalStep"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalInstance_salesOrderId_key" ON "ApprovalInstance"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalInstance_purchaseOrderId_key" ON "ApprovalInstance"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "ApprovalInstance_workflowId_idx" ON "ApprovalInstance"("workflowId");

-- CreateIndex
CREATE INDEX "ApprovalInstance_status_idx" ON "ApprovalInstance"("status");

-- CreateIndex
CREATE INDEX "ApprovalAction_instanceId_idx" ON "ApprovalAction"("instanceId");

-- CreateIndex
CREATE INDEX "ApprovalAction_stepId_idx" ON "ApprovalAction"("stepId");

-- CreateIndex
CREATE INDEX "CreditNoteItem_creditNoteId_idx" ON "CreditNoteItem"("creditNoteId");

-- CreateIndex
CREATE INDEX "CreditNoteItem_serviceCategoryId_idx" ON "CreditNoteItem"("serviceCategoryId");

-- CreateIndex
CREATE INDEX "DebitNoteItem_debitNoteId_idx" ON "DebitNoteItem"("debitNoteId");

-- CreateIndex
CREATE INDEX "DebitNoteItem_serviceCategoryId_idx" ON "DebitNoteItem"("serviceCategoryId");

-- CreateIndex
CREATE INDEX "InvoiceTemplate_isDefault_idx" ON "InvoiceTemplate"("isDefault");
