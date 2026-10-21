import type { PrismaClient } from '@prisma/client';

/** Print row counts per table (end of seed / recompute). */
export async function printRowCounts(client: PrismaClient) {
  const counts: Record<string, number> = {
    Site: await client.site.count(),
    Department: await client.department.count(),
    Position: await client.position.count(),
    Employee: await client.employee.count(),
    GovId: await client.govId.count(),
    Dependent: await client.dependent.count(),
    EmploymentEvent: await client.employmentEvent.count(),
    EmployeeDocument: await client.employeeDocument.count(),
    User: await client.user.count(),
    Device: await client.device.count(),
    RawPunch: await client.rawPunch.count(),
    Shift: await client.shift.count(),
    Holiday: await client.holiday.count(),
    DailyTimeRecord: await client.dailyTimeRecord.count(),
    LeaveType: await client.leaveType.count(),
    LeaveBalance: await client.leaveBalance.count(),
    LeaveRequest: await client.leaveRequest.count(),
    OtRequest: await client.otRequest.count(),
    UndertimeRequest: await client.undertimeRequest.count(),
    DtrCorrection: await client.dtrCorrection.count(),
    ApprovalRequest: await client.approvalRequest.count(),
    'ApprovalRequest (pending)': await client.approvalRequest.count({
      where: { status: 'PENDING' },
    }),
    StatutoryRate: await client.statutoryRate.count(),
    PayrollRun: await client.payrollRun.count(),
    Payslip: await client.payslip.count(),
    AuditLog: await client.auditLog.count(),
  };
  console.log('\nRow counts:');
  console.table(counts);
  if (counts.DailyTimeRecord === 0)
    console.log('(DailyTimeRecord rows are created next by the attendance recompute.)');
}
