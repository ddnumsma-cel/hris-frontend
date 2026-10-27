-- Recruitment (job requisitions and applicants from the shared job link) and assigned trainings.
CREATE TABLE "JobRequisition" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "cluster" TEXT,
  "office" TEXT NOT NULL,
  "openings" INTEGER NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'Sourcing',
  "approval" TEXT NOT NULL DEFAULT 'Pending L1',
  "employmentType" TEXT,
  "targetStart" DATE,
  "salaryRange" TEXT,
  "justification" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobRequisition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Applicant" (
  "id" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "stage" TEXT NOT NULL DEFAULT 'Applied',
  "source" TEXT,
  "note" TEXT,
  "appliedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "profile" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Applicant_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "JobRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Applicant_requisitionId_idx" ON "Applicant"("requisitionId");

CREATE TABLE "TrainingRecord" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "course" TEXT NOT NULL,
  "dueDate" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Not started',
  "assignedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrainingRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TrainingRecord_employeeId_idx" ON "TrainingRecord"("employeeId");
