-- Approval workflows: each request keeps the steps that applied when filed, the step it is at, and earlier approvals.
ALTER TABLE "ApprovalRequest"
  ADD COLUMN "steps" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "step" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stepLog" JSONB NOT NULL DEFAULT '[]';
