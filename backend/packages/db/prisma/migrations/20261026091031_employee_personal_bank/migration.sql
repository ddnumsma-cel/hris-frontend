-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNo" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "cluster" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "sex" "Sex",
ADD COLUMN     "suffix" TEXT;
