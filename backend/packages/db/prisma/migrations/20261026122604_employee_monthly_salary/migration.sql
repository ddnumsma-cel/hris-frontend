-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "monthlySalary" DECIMAL(14,2);

-- Backfill from the daily rate (daily = monthly × 12 ÷ 261); HR can correct a person's exact salary on their record.
UPDATE "Employee" SET "monthlySalary" = ROUND("dailyRate" * 261 / 12, 2) WHERE "monthlySalary" IS NULL;
