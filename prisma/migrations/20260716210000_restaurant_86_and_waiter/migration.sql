-- AlterTable
ALTER TABLE "Product" ADD COLUMN "unavailableUntil" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RestaurantTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableNumber" TEXT NOT NULL,
    "tableName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "waiterId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantTable_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RestaurantTable" ("createdAt", "id", "status", "tableName", "tableNumber") SELECT "createdAt", "id", "status", "tableName", "tableNumber" FROM "RestaurantTable";
DROP TABLE "RestaurantTable";
ALTER TABLE "new_RestaurantTable" RENAME TO "RestaurantTable";
CREATE UNIQUE INDEX "RestaurantTable_tableNumber_key" ON "RestaurantTable"("tableNumber");
CREATE INDEX "RestaurantTable_waiterId_idx" ON "RestaurantTable"("waiterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
