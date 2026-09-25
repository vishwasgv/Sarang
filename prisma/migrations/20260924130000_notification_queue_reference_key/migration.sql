-- AlterTable
ALTER TABLE "NotificationQueue" ADD COLUMN "referenceKey" TEXT;

-- CreateIndex
CREATE INDEX "NotificationQueue_referenceKey_idx" ON "NotificationQueue"("referenceKey");
