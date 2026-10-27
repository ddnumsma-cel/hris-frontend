-- Requisition approval: Partner (L1), then HR (L2); who asked, who approved each step, and declines.
ALTER TABLE "JobRequisition"
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "l1ApprovedBy" TEXT,
  ADD COLUMN "l1ApprovedAt" TIMESTAMPTZ(3),
  ADD COLUMN "l2ApprovedBy" TEXT,
  ADD COLUMN "l2ApprovedAt" TIMESTAMPTZ(3),
  ADD COLUMN "declinedBy" TEXT,
  ADD COLUMN "declinedAt" TIMESTAMPTZ(3),
  ADD COLUMN "declineReason" TEXT;
