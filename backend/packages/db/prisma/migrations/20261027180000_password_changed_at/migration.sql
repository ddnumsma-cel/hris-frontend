-- When a password was last changed or reset: sessions started before it end.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMPTZ(3);
