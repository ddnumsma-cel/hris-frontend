-- Remote work days, work-from-home days and face-scan punches from home; punches can be set aside.
ALTER TABLE "RawPunch" ADD COLUMN "voidedAt" TIMESTAMPTZ(3);

CREATE TABLE "RemoteDay" (
    "id" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "offices" TEXT[],
    "reason" TEXT NOT NULL,
    "declaredBy" TEXT NOT NULL,
    "declaredById" TEXT,
    "declaredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMPTZ(3),
    CONSTRAINT "RemoteDay_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RemoteDay_fromDate_toDate_idx" ON "RemoteDay"("fromDate", "toDate");

CREATE TABLE "WfhDay" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "declaredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WfhDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WfhDay_employeeId_date_key" ON "WfhDay"("employeeId", "date");
ALTER TABLE "WfhDay" ADD CONSTRAINT "WfhDay_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RemotePunch" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "punchedAt" TIMESTAMPTZ(3) NOT NULL,
    "match" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "locationNote" TEXT,
    "reason" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "rawPunchId" TEXT,
    "voidedAt" TIMESTAMPTZ(3),
    "voidReason" TEXT,
    "voidedBy" TEXT,
    CONSTRAINT "RemotePunch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RemotePunch_employeeId_workDate_idx" ON "RemotePunch"("employeeId", "workDate");
ALTER TABLE "RemotePunch" ADD CONSTRAINT "RemotePunch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
