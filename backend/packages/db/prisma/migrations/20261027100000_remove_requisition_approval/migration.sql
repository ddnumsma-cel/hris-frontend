-- Requisition approval was taken back out (the previous migration added these columns).
ALTER TABLE "JobRequisition"
  DROP COLUMN "createdById",
  DROP COLUMN "l1ApprovedBy",
  DROP COLUMN "l1ApprovedAt",
  DROP COLUMN "l2ApprovedBy",
  DROP COLUMN "l2ApprovedAt",
  DROP COLUMN "declinedBy",
  DROP COLUMN "declinedAt",
  DROP COLUMN "declineReason";
