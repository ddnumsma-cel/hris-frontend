-- Certificate requests (COE, BIR 2316, employment verification) and the copy filed when HR issues one.
CREATE TABLE "CertificateRequest" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "requestedOn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "handledBy" TEXT,
  "handledAt" TIMESTAMPTZ(3),
  "delivery" TEXT,
  "note" TEXT,
  "issued" JSONB,
  CONSTRAINT "CertificateRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CertificateRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CertificateRequest_employeeId_idx" ON "CertificateRequest"("employeeId");
