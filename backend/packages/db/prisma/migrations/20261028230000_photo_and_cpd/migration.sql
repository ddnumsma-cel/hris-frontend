-- Profile photos (kept apart from Employee) and the CPD units logged for a professional license.
ALTER TABLE "Employee" ADD COLUMN "cpdUnitsEarned" INTEGER;
CREATE TABLE "EmployeePhoto" (
    "employeeId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "EmployeePhoto_pkey" PRIMARY KEY ("employeeId")
);
ALTER TABLE "EmployeePhoto" ADD CONSTRAINT "EmployeePhoto_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
