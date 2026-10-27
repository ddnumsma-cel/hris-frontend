-- Payroll inputs and the holiday calendar, set on the website and kept here so every browser sees the same.
CREATE TABLE "AppSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "PayProfile" (
  "employeeId" TEXT NOT NULL,
  "workWeek" TEXT NOT NULL DEFAULT '5-day',
  "transportAllowance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "otMealRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "deMinimis" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "otherNonTaxable" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "clientShare" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "client" TEXT NOT NULL DEFAULT '',
  "skipSss" BOOLEAN NOT NULL DEFAULT false,
  "skipPhilhealth" BOOLEAN NOT NULL DEFAULT false,
  "skipPagibig" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PayProfile_pkey" PRIMARY KEY ("employeeId"),
  CONSTRAINT "PayProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Loan" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "principal" DECIMAL(14,2) NOT NULL,
  "installment" DECIMAL(14,2) NOT NULL,
  "startDate" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "note" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedBy" TEXT,
  "closedAt" TIMESTAMPTZ(3),
  CONSTRAINT "Loan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Loan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Loan_employeeId_idx" ON "Loan"("employeeId");

CREATE TABLE "HolidayRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "HolidayType" NOT NULL,
  "repeat" JSONB NOT NULL,
  "offices" TEXT[],
  "source" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HolidayRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HolidayChange" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "date" DATE,
  "source" TEXT NOT NULL,
  "by" TEXT NOT NULL,
  "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HolidayChange_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HolidayChange_ruleId_year_key" ON "HolidayChange"("ruleId", "year");
