-- User accounts managed from the website: on/off, temporary passwords to replace, who added them.
ALTER TABLE "User"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "createdBy" TEXT;
