-- Punches are append-only (no UPDATE or DELETE), so setting one aside is a separate record, not a column on the punch.
ALTER TABLE "RawPunch" DROP COLUMN "voidedAt";

CREATE TABLE "PunchVoid" (
    "rawPunchId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PunchVoid_pkey" PRIMARY KEY ("rawPunchId")
);
ALTER TABLE "PunchVoid" ADD CONSTRAINT "PunchVoid_rawPunchId_fkey" FOREIGN KEY ("rawPunchId") REFERENCES "RawPunch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
