-- Reimbursement claims: approver endorses, Accounting gives the final approval and releases the money.
CREATE TABLE "Claim" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "otherType" TEXT,
  "merchant" TEXT NOT NULL,
  "purchaseDate" DATE NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "description" TEXT NOT NULL,
  "receipt" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "filedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approverDecidedBy" TEXT,
  "approverDecidedAt" TIMESTAMPTZ(3),
  "approverNote" TEXT,
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMPTZ(3),
  "note" TEXT,
  "paidAt" TIMESTAMPTZ(3),
  "paidBy" TEXT,
  "payoutMethod" TEXT,
  "payoutRef" TEXT,
  CONSTRAINT "Claim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Claim_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Claim_employeeId_filedAt_idx" ON "Claim"("employeeId", "filedAt");
CREATE INDEX "Claim_status_idx" ON "Claim"("status");
