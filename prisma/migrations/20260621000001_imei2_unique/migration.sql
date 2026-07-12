-- Add unique constraint to imei2Number for dual-SIM IMEI integrity
CREATE UNIQUE INDEX IF NOT EXISTS "ProductSerial_imei2Number_key" ON "ProductSerial"("imei2Number");
