-- 2026-09-01 — foreign-currency overlay on Invoice/Bill/Payment/
-- SupplierPayment. Base-currency fields (totalAmount/paidAmount/
-- balanceAmount/amount) are completely unchanged everywhere — these are
-- purely additive, nullable columns. See each model's own schema comment.

ALTER TABLE "Bill" ADD COLUMN "foreignCurrencyCode" TEXT;
ALTER TABLE "Bill" ADD COLUMN "foreignExchangeRate" REAL;
ALTER TABLE "Bill" ADD COLUMN "foreignTotalAmount" REAL;

ALTER TABLE "Invoice" ADD COLUMN "foreignCurrencyCode" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "foreignExchangeRate" REAL;
ALTER TABLE "Invoice" ADD COLUMN "foreignTotalAmount" REAL;

ALTER TABLE "Payment" ADD COLUMN "foreignCurrencyCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN "foreignAmount" REAL;
ALTER TABLE "Payment" ADD COLUMN "foreignExchangeRate" REAL;

ALTER TABLE "SupplierPayment" ADD COLUMN "foreignCurrencyCode" TEXT;
ALTER TABLE "SupplierPayment" ADD COLUMN "foreignAmount" REAL;
ALTER TABLE "SupplierPayment" ADD COLUMN "foreignExchangeRate" REAL;
