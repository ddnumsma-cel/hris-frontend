import { Injectable } from '@nestjs/common';
import { cutoffFor, DashboardQuery, DashboardSummary, manilaToday, payDateFor } from '@msma/shared';
import { ApprovalsService } from '../approvals/approvals.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AuthUser, canSeePay, requireEmployeeId } from '../common/auth.decorators';
import { DevicesService } from '../devices/devices.service';
import { EmployeesService } from '../employees/employees.service';
import { PayrollService } from '../payroll/payroll.service';

const TREND_DAYS = 14;
const LATEST_PUNCHES = 10;

/** Read-only aggregation for the HR dashboard; composes the other modules' services. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly employees: EmployeesService,
    private readonly attendance: AttendanceService,
    private readonly approvals: ApprovalsService,
    private readonly devices: DevicesService,
    private readonly payroll: PayrollService,
  ) {}

  async summary(user: AuthUser, q: DashboardQuery): Promise<DashboardSummary> {
    const today = manilaToday();
    const date = q.date ?? today;
    // Managers are limited to their own site.
    const siteId =
      user.role === 'MANAGER'
        ? ((await this.employees.siteIdOf(requireEmployeeId(user))) ?? undefined)
        : q.siteId;
    if (date === today) await this.attendance.ensureDay(date);

    const cutoff = cutoffFor(date);
    const approvalScope = await this.approvals.scopeIds(user).catch(() => [] as string[]);
    const [
      headcount,
      counts,
      trend,
      punches,
      deviceStatus,
      deviceNames,
      sites,
      pending,
      payroll,
      openIssues,
    ] = await Promise.all([
      this.employees.count(siteId),
      this.attendance.dayCounts(date, siteId),
      this.attendance.trend(date, TREND_DAYS, siteId),
      this.attendance.latestPunches(LATEST_PUNCHES, siteId),
      this.devices.status(siteId),
      this.devices.names(),
      this.employees.sites(),
      this.approvals.countPending(approvalScope, siteId),
      canSeePay(user.role) ? this.payroll.preview(cutoff.code, siteId) : Promise.resolve(null),
      this.attendance.missingTimeOutCount(cutoff.from, cutoff.to, siteId),
    ]);

    return {
      date,
      siteId: siteId ?? null,
      generatedAt: new Date().toISOString(),
      kpis: {
        headcount,
        present: counts.total.present,
        late: counts.total.late,
        absent: counts.total.absent,
        onLeave: counts.total.onLeave,
        pendingApprovals: pending,
      },
      presentBySite: sites
        .filter((s) => !siteId || s.id === siteId)
        .map((s) => {
          const c = counts.bySite.get(s.id);
          return {
            siteId: s.id,
            siteName: s.name,
            present: c?.present ?? 0,
            scheduled: c?.scheduled ?? 0,
          };
        }),
      trend,
      latestPunches: punches.map(({ deviceSerial, ...p }) => ({
        ...p,
        deviceName: deviceNames.get(deviceSerial) ?? deviceSerial,
      })),
      devices: deviceStatus,
      payroll: payroll
        ? {
            sample: true,
            cutoff: cutoff.code,
            label: cutoff.label,
            payDate: payDateFor(cutoff.to),
            employees: payroll.totals.employees,
            gross: payroll.totals.gross,
            deductions: payroll.totals.deductions,
            net: payroll.totals.net,
            openIssues,
          }
        : null,
    };
  }
}
