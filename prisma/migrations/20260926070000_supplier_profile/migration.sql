ALTER TABLE "Supplier" ADD COLUMN "creditLimit" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Supplier" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "supplierCategory" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "rating" INTEGER;
