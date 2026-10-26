-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "managerId" TEXT;

-- CreateTable
CREATE TABLE "SiteDepartment" (
    "siteId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "headEmployeeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteDepartment_pkey" PRIMARY KEY ("siteId","departmentId")
);

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDepartment" ADD CONSTRAINT "SiteDepartment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDepartment" ADD CONSTRAINT "SiteDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDepartment" ADD CONSTRAINT "SiteDepartment_headEmployeeId_fkey" FOREIGN KEY ("headEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every office + department pair people already work in becomes a department at that office.
INSERT INTO "SiteDepartment" ("siteId", "departmentId")
SELECT DISTINCT "siteId", "departmentId" FROM "Employee"
ON CONFLICT DO NOTHING;
