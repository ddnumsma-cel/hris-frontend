-- AlterEnum
ALTER TYPE "ApprovalType" ADD VALUE 'UNDERTIME';

-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN     "undertimeRequestId" TEXT;

-- CreateTable
CREATE TABLE "UndertimeRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "leaveAt" TIMESTAMPTZ(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UndertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UndertimeRequest_employeeId_date_idx" ON "UndertimeRequest"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_undertimeRequestId_key" ON "ApprovalRequest"("undertimeRequestId");

-- AddForeignKey
ALTER TABLE "UndertimeRequest" ADD CONSTRAINT "UndertimeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_undertimeRequestId_fkey" FOREIGN KEY ("undertimeRequestId") REFERENCES "UndertimeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

