-- AlterTable
ALTER TABLE "JobCard" ADD COLUMN "invoiceId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "invoiceId" TEXT;

-- AlterTable
ALTER TABLE "ServiceTicket" ADD COLUMN "invoiceId" TEXT;

-- Deliberately NOT including the "RedefineIndex" statements `prisma migrate
-- dev` also generated here (DeliveryTracker/DrivingVehicle/LearnerProfile/
-- StudentProfile/TokenQueue/VisitNote) — those are pre-existing schema drift
-- unrelated to this migration's purpose (SQLite auto-named the unique-
-- constraint-backing index `sqlite_autoindex_X_2` instead of Prisma's
-- expected explicit name, and SQLite refuses to DROP an autoindex that
-- backs an inline UNIQUE constraint without also dropping the constraint,
-- so those statements fail outright — see project memory on schema drift
-- for the wider pattern). Out of scope for the invoicing-bridge change;
-- flagged separately rather than silently bundled into an unrelated
-- migration.
