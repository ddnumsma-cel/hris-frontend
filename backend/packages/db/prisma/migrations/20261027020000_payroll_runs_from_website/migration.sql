-- Payroll runs made on the website: it works out the lines, the backend keeps and locks them.
ALTER TABLE "PayrollRun"
  ADD COLUMN "label" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "lines" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "adjustments" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "auto" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "createdBy" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "computedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMPTZ(3),
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMPTZ(3);
