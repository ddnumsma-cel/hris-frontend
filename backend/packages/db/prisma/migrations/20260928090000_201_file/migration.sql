-- CreateEnum
CREATE TYPE "CivilStatus" AS ENUM ('SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED', 'ANNULLED');

-- CreateEnum
CREATE TYPE "DependentRelationship" AS ENUM ('CHILD', 'SPOUSE', 'PARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('RESUME', 'BIRTH_CERTIFICATE', 'MARRIAGE_CERTIFICATE', 'CHILD_BIRTH_CERTIFICATE', 'GOVERNMENT_ID', 'DIPLOMA_TOR', 'PROFESSIONAL_LICENSE', 'PREVIOUS_COE', 'NBI_CLEARANCE', 'POLICE_CLEARANCE', 'MEDICAL_RESULTS', 'TIN_BIR_1902', 'SSS_E1', 'PHILHEALTH_PMRF', 'PAGIBIG_MDF', 'PREVIOUS_BIR_2316', 'EMPLOYMENT_CONTRACT', 'JOB_DESCRIPTION', 'PERSONAL_DATA_SHEET', 'PROBATION_REGULARIZATION', 'PERSONNEL_ACTION', 'HANDBOOK_ACKNOWLEDGMENT', 'DATA_PRIVACY_CONSENT', 'BIOMETRIC_CONSENT', 'NDA', 'PERFORMANCE_APPRAISAL', 'TRAINING_CERTIFICATE', 'LEAVE_RECORDS', 'COMMENDATION', 'DISCIPLINARY_RECORD', 'LOAN_DOCUMENT', 'RECORD_UPDATE', 'RESIGNATION_LETTER', 'TERMINATION_NOTICE', 'CLEARANCE_FORM', 'FINAL_PAY_QUITCLAIM', 'COE_ISSUED', 'SEPARATION_BIR_2316');

-- CreateEnum
CREATE TYPE "EmploymentEventType" AS ENUM ('HIRED', 'REGULARIZED', 'PROMOTED', 'TRANSFERRED', 'SALARY_ADJUSTED', 'SEPARATED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "address" TEXT,
ADD COLUMN     "biometricEnrolledAt" TIMESTAMPTZ(3),
ADD COLUMN     "civilStatus" "CivilStatus",
ADD COLUMN     "emergencyName" TEXT,
ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "emergencyRelationship" TEXT,
ADD COLUMN     "licenseType" TEXT,
ADD COLUMN     "personalEmail" TEXT,
ADD COLUMN     "regularizationDate" DATE,
ADD COLUMN     "separationDate" DATE,
ADD COLUMN     "separationReason" TEXT;

-- CreateTable
CREATE TABLE "Dependent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" "DependentRelationship" NOT NULL,
    "birthDate" DATE,

    CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "issuedOn" DATE,
    "expiresOn" DATE,
    "referenceNo" TEXT,
    "notes" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMPTZ(3),
    "archivedReason" TEXT,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentEvent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "EmploymentEventType" NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "positionTitle" TEXT,
    "siteName" TEXT,
    "dailyRate" DECIMAL(14,2),
    "remarks" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmploymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dependent_employeeId_idx" ON "Dependent"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_type_idx" ON "EmployeeDocument"("employeeId", "type");

-- CreateIndex
CREATE INDEX "EmployeeDocument_expiresOn_idx" ON "EmployeeDocument"("expiresOn");

-- CreateIndex
CREATE INDEX "EmploymentEvent_employeeId_effectiveDate_idx" ON "EmploymentEvent"("employeeId", "effectiveDate");

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentEvent" ADD CONSTRAINT "EmploymentEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

