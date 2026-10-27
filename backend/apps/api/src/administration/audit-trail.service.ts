import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../common/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

/** The website's areas (Administration › Audit trail filter). */
type Module = 'People' | 'Timekeeping' | 'Leave' | 'Payroll' | 'Administration' | 'Sign-in' | 'Settings';

/** Which area an action belongs to, by its name. */
function moduleOf(action: string, after: Record<string, unknown> | null): Module {
  if (action.startsWith('APPROVAL_')) return after?.type === 'LEAVE' ? 'Leave' : 'Timekeeping';
  if (/^(LEAVE_)/.test(action)) return 'Leave';
  if (/^(PAYROLL_|PAY_|PAYDAYS_|LOAN_)/.test(action)) return 'Payroll';
  if (/^(DEVICE_|USUAL_SHIFT|SHIFT_|DTR_|OT_|UNDERTIME_|TIME_|ATTENDANCE_|TEST_DATA_)/.test(action)) return 'Timekeeping';
  if (/^(LOGIN|SIGN|AUTH_)/.test(action)) return 'Sign-in';
  if (/^(EMPLOYEE_|PERSONAL_INFO|BIOMETRIC_|DOCUMENT_|GOV_IDS)/.test(action)) return 'People';
  return 'Administration';
}

/** "PAYROLL_RUN_CREATED" -> "Payroll run created". */
const words = (action: string) => {
  const w = action.toLowerCase().replace(/_/g, ' ');
  return w.charAt(0).toUpperCase() + w.slice(1);
};

/** A short line from the change: "label: Oct 26 – Nov 10 · employees: 8". */
function detailOf(before: unknown, after: unknown): string {
  const pick = (v: unknown) =>
    v && typeof v === 'object'
      ? Object.entries(v as Record<string, unknown>)
          .filter(([k, x]) => x !== null && x !== undefined && !/id$/i.test(k) && typeof x !== 'object')
          .map(([k, x]) => `${k}: ${String(x)}`)
          .join(' · ')
      : '';
  const a = pick(after);
  const b = pick(before);
  return (a || (b ? `was ${b}` : '')).slice(0, 240);
}

/**
 * The Audit trail page from the backend's audit log (every change made through it), newest first. HR and the Super
 * Admin see every area; Accounting only Payroll; the rest have no audit trail.
 */
@Injectable()
export class AuditTrailService {
  constructor(private readonly prisma: PrismaService) {}

  async rows(user: AuthUser) {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take: 2000, include: { actor: { select: { displayName: true } } } });
    const employeeIds = [...new Set(rows.filter((r) => r.entity === 'Employee').map((r) => r.entityId))];
    const people = new Map(
      (await this.prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, firstName: true, lastName: true } })).map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
    );
    const out = rows.map((r) => {
      const after = (r.after ?? null) as Record<string, unknown> | null;
      const named = after && (after.title ?? after.subject ?? after.label ?? after.name ?? after.employeeNo ?? after.employee);
      return {
        id: r.id,
        at: r.at.toISOString(),
        actor: r.actor?.displayName ?? 'System',
        module: moduleOf(r.action, after),
        action: words(r.action),
        target: r.entity === 'Employee' ? (people.get(r.entityId) ?? r.entityId) : typeof named === 'string' ? named : r.entity,
        detail: detailOf(r.before, r.after),
      };
    });
    return user.role === 'PAYROLL_ADMIN' ? out.filter((r) => r.module === 'Payroll') : out;
  }
}
