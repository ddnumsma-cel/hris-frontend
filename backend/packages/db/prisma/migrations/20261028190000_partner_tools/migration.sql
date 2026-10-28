-- The approver's people tools: employee relations cases and performance review status.
CREATE TABLE "EmployeeCase" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "summary" TEXT NOT NULL,
    "filedBy" TEXT NOT NULL,
    "filedById" TEXT,
    "filedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(3),
    "closedBy" TEXT,
    CONSTRAINT "EmployeeCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmployeeCase_employeeId_idx" ON "EmployeeCase"("employeeId");
ALTER TABLE "EmployeeCase" ADD CONSTRAINT "EmployeeCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PerformanceReview" (
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("employeeId","year")
);
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
