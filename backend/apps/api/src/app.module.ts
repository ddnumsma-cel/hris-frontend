import { AdministrationModule } from './administration/administration.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PoliciesModule } from './policies/policies.module';
import { HolidaysModule } from './holidays/holidays.module';
import { Module } from '@nestjs/common';
import { ApprovalsModule } from './approvals/approvals.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuditModule } from './audit/audit.service';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DevicesModule } from './devices/devices.module';
import { DocumentsModule } from './documents/documents.module';
import { EmployeesHttpModule } from './employees/employees-http.module';
import { EmployeesModule } from './employees/employees.module';
import { HealthController } from './health.controller';
import { LeaveModule } from './leave/leave.module';
import { MeModule } from './me/me.module';
import { PayrollModule } from './payroll/payroll.module';
import { PrismaModule } from './prisma/prisma.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    EmployeesModule,
    EmployeesHttpModule,
    DocumentsModule,
    LeaveModule,
    AttendanceModule,
    DevicesModule,
    ApprovalsModule,
    PayrollModule,
    HolidaysModule,
    PoliciesModule,
    OnboardingModule,
    AdministrationModule,
    DashboardModule,
    MeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
