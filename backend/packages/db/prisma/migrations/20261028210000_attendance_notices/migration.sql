-- Tardiness and AWOL notices (never change pay); the employee acknowledges them.
CREATE TABLE "AttendanceNotice" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dates" TEXT[],
    "sentBy" TEXT NOT NULL,
    "sentById" TEXT,
    "sentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ(3),
    CONSTRAINT "AttendanceNotice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AttendanceNotice_employeeId_idx" ON "AttendanceNotice"("employeeId");
ALTER TABLE "AttendanceNotice" ADD CONSTRAINT "AttendanceNotice_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
