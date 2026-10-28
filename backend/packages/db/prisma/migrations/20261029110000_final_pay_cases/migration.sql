-- Final pay cases (one per employee); releasing freezes the figures.
CREATE TABLE "FinalPayCase" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "lastDay" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "openedBy" TEXT NOT NULL,
    "openedById" TEXT,
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMPTZ(3),
    "releasedBy" TEXT,
    "reference" TEXT,
    "items" JSONB,
    "total" DECIMAL(14,2),
    CONSTRAINT "FinalPayCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinalPayCase_employeeId_key" ON "FinalPayCase"("employeeId");
ALTER TABLE "FinalPayCase" ADD CONSTRAINT "FinalPayCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
