-- 201 document review: employees submit papers, HR verifies or returns them, and marks papers not applicable / required.
ALTER TABLE "EmployeeDocument" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'VERIFIED';
ALTER TABLE "EmployeeDocument" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "EmployeeDocument" ADD COLUMN "reviewedAt" TIMESTAMPTZ(3);

CREATE TABLE "DocumentRequirement" (
    "employeeId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "state" TEXT,
    "returnNote" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DocumentRequirement_pkey" PRIMARY KEY ("employeeId","type")
);
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
