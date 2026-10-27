-- Leave types with the website's rules, and HR's VL/SL credit adjustments.
ALTER TABLE "LeaveType"
  ADD COLUMN "earning" JSONB NOT NULL DEFAULT '{"kind":"yearly"}',
  ADD COLUMN "carryOverMax" DECIMAL(5,1) NOT NULL DEFAULT 0,
  ADD COLUMN "countBy" TEXT NOT NULL DEFAULT 'workdays',
  ADD COLUMN "eligibility" TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN "attachmentOver" DECIMAL(5,1),
  ADD COLUMN "confidential" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "basis" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "LeaveAdjustment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "days" DECIMAL(5,1) NOT NULL,
  "reason" TEXT NOT NULL,
  "by" TEXT NOT NULL,
  "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaveAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "LeaveAdjustment_employeeId_idx" ON "LeaveAdjustment"("employeeId");

-- The three existing types: what they are based on.
UPDATE "LeaveType" SET "basis" = 'Company policy' WHERE "basis" = '';
