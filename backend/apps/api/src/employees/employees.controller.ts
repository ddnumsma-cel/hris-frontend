import {
  Body,
  ConflictException,
  Delete,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  BiometricEnrollment,
  BiometricEnrollmentSchema,
  canReview201Files,
  CreatedEmployeeSchema,
  CreateEmployee,
  CreateEmployeeSchema,
  EmployeeDetail,
  EmployeeDetailSchema,
  EmployeeListQuery,
  EmployeeListQuerySchema,
  EmployeeListResponse,
  EmployeeListResponseSchema,
  manilaToday,
  OrgFiltersSchema,
  PersonalInfoSchema,
  RecordSeparation,
  RecordSeparationSchema,
  Separation,
  SeparationSchema,
  SetManager,
  SetManagerSchema,
  UpdatePersonalInfo,
  UpdatePersonalInfoSchema,
} from '@msma/shared';
import { AttendanceService } from '../attendance/attendance.service';
import { DevicesService } from '../devices/devices.service';
import { SubscriptionService } from '../administration/subscription.service';
import { AuthUser, canSeePay, CurrentUser, isHrLike, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodQuery, ApiZodResponse, ZodPipe } from '../common/zod';
import { DocumentsService } from '../documents/documents.service';
import { LeaveService } from '../leave/leave.service';
import { EmployeesService } from './employees.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { notSelf } from '../common/not-self';


@ApiTags('employees')
@ApiBearerAuth()
@Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN', 'MANAGER')
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly attendance: AttendanceService,
    private readonly leave: LeaveService,
    private readonly documents: DocumentsService,
    private readonly devices: DevicesService,
    private readonly subscription: SubscriptionService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** Managers only see their direct reports (an approver login with no employee record has no team: nobody). */
  private async scope(user: AuthUser): Promise<string[] | undefined> {
    if (user.role !== 'MANAGER') return undefined;
    return user.employeeId ? this.employees.teamIds(user.employeeId) : [];
  }

  @Get()
  @ApiOperation({
    operationId: 'listEmployees',
    summary: 'Employee 201 list with search, filters and pagination',
  })
  @ApiZodQuery(EmployeeListQuerySchema)
  @ApiZodResponse(EmployeeListResponseSchema)
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(EmployeeListQuerySchema)) q: EmployeeListQuery,
  ): Promise<EmployeeListResponse> {
    const result = await this.employees.list(q, await this.scope(user));
    const ids = result.items.map((i) => i.id);
    const [statuses, details, briefs] = await Promise.all([
      this.attendance.statusForDate(ids, manilaToday()),
      this.attendance.dayDetails(ids, manilaToday()),
      canReview201Files(user.role) ? this.documents.briefs(ids) : new Map(),
    ]);
    return {
      ...result,
      items: result.items.map((i) => ({
        ...i,
        // Pay is for HR, Accounting and the Super Admin; an approver sees their team without it.
        dailyRate: canSeePay(user.role) ? i.dailyRate : null,
        todayStatus: statuses.get(i.id) ?? null,
        today: details.get(i.id) ?? null,
        record201: briefs.get(i.id) ?? null,
      })),
    };
  }

  @Get('filters')
  @ApiOperation({
    operationId: 'getEmployeeFilters',
    summary: 'Sites, departments and statuses for filters',
  })
  @ApiZodResponse(OrgFiltersSchema)
  filters() {
    return this.employees.filters();
  }

  @Post()
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'createEmployee',
    summary: 'Add a new hire',
    description:
      'Creates the record with the next MSMA employee number and device PIN, their government numbers, a HIRED history entry and an audit row. Daily rate = monthly × 12 ÷ 261.',
  })
  @ApiZodBody(CreateEmployeeSchema)
  @ApiZodResponse(CreatedEmployeeSchema, 201)
  @ApiResponse({ status: 409, description: 'The work email or mobile number is already on another record' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreateEmployeeSchema)) body: CreateEmployee,
  ) {
    // A new hire takes a seat: refused (409 SEAT_LIMIT_REACHED) past the plan's limit plus grace.
    await this.subscription.assertSeats(1);
    const created = await this.employees.create(body, user.userId);
    // Put them on the attendance terminals now; they register a face or finger there.
    await this.devices.addEmployeeToTerminals(created.id);
    return created;
  }

  @Post(':id/separation')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'recordSeparation',
    summary: 'HR marks an employee Separated',
    description:
      'Saves the last day and a SEPARATED history entry. After the last day they come off the attendance terminals (right away if it has already passed).',
  })
  @ApiZodBody(RecordSeparationSchema)
  @ApiZodResponse(SeparationSchema, 201)
  @ApiResponse({ status: 409, description: 'Already marked separated' })
  async recordSeparation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(RecordSeparationSchema)) body: RecordSeparation,
  ): Promise<Separation> {
    await this.employees.recordSeparation(id, body, user.userId);
    await this.devices.removeIfSeparated(id);
    // Accounting prepares the final pay.
    const who = await this.employees.profile(id);
    await this.notifications.send({ topic: 'separation', kind: 'request', title: `Final pay to prepare for ${who.fullName}`, body: `${body.reason}, last day ${body.lastDay}.`, roles: ['PAYROLL_ADMIN'], actorId: user.userId });
    return { employeeId: id, lastDay: body.lastDay };
  }

  @Delete(':id/separation')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'cancelSeparation',
    summary: 'Cancel a separation recorded by mistake or a withdrawn resignation',
    description: 'Removes the mark and last day; if they were already taken off the terminals they are added back (they register a face or finger again).',
  })
  @ApiZodResponse(SeparationSchema)
  async cancelSeparation(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Separation> {
    // Bringing back someone already separated takes a seat again.
    if ((await this.employees.devicePins()).every((e) => e.id !== id)) await this.subscription.assertSeats(1);
    await this.employees.cancelSeparation(id, user.userId);
    await this.devices.addEmployeeToTerminals(id);
    return { employeeId: id, lastDay: null };
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getEmployee',
    summary: 'Employee profile, government IDs, last 14 DTRs and leave balances',
  })
  @ApiZodResponse(EmployeeDetailSchema)
  async detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<EmployeeDetail> {
    const scope = await this.scope(user);
    if (scope && !scope.includes(id))
      throw new ForbiddenException('This employee is not on your team');
    const [profile, personal, history, enrolledAt, dtrs, leaveBalances, status] = await Promise.all(
      [
        this.employees.profile(id),
        this.employees.personal(id),
        this.employees.history(id, canSeePay(user.role)),
        this.employees.biometricEnrolledAt(id),
        this.attendance.recentDtrs(id, 14),
        this.leave.balances(id),
        this.attendance.statusForDate([id], manilaToday()),
      ],
    );
    // Government IDs, pay and birth dates are for HR, Accounting and the Super Admin (and the person themselves);
    // an approver sees the rest of their team member's record without them.
    const showIds = isHrLike(user.role) || user.role === 'PAYROLL_ADMIN' || user.employeeId === id;
    const govIds = showIds ? profile.govIds : null;
    // Personal data sheet (address, dependents, emergency contact): HR, System Admin and the employee only.
    const showPersonal = isHrLike(user.role) || user.employeeId === id;
    return {
      ...profile,
      ...(canSeePay(user.role) ? {} : { dailyRate: null }),
      ...(showIds ? {} : { birthDate: null }),
      govIds,
      todayStatus: status.get(id) ?? null,
      personal: showPersonal ? personal : null,
      history,
      biometricEnrolledAt: enrolledAt?.toISOString() ?? null,
      dtrs,
      leaveBalances,
    };
  }

  @Patch(':id/personal')
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN')
  @ApiOperation({
    operationId: 'updatePersonalInfo',
    summary: 'Update the personal data sheet, dependents and government numbers',
    description: 'HR: every field. Payroll: government numbers only. Every change is audit-logged.',
  })
  @ApiZodBody(UpdatePersonalInfoSchema)
  @ApiZodResponse(PersonalInfoSchema)
  updatePersonal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(UpdatePersonalInfoSchema)) body: UpdatePersonalInfo,
  ) {
    if (user.role === 'PAYROLL_ADMIN') {
      const other = Object.keys(body).filter((k) => k !== 'govIds' && k !== 'effectiveDate');
      if (other.length) throw new ForbiddenException('Payroll can only update government numbers');
    }
    return this.employees.updatePersonal(id, body, user.userId);
  }

  @Put(':id/manager')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'setManager', summary: 'Org chart: change who this person reports to (their approver)' })
  @ApiZodBody(SetManagerSchema)
  async setManager(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(SetManagerSchema)) body: SetManager) {
    // Who approves your own requests isn't yours to change.
    notSelf(user, id, 'change who you report to');
    const r = await this.employees.setManager(id, body.managerNo, user.userId);
    if (r.changed) {
      await this.notifications.send({ topic: 'orgchart', kind: 'update', title: r.manager ? `You now report to ${r.manager}` : 'Your manager changed', body: r.manager ? 'They approve your leave, overtime and claims from now on.' : 'You no longer have a manager on the org chart.', employeeIds: [id], actorId: user.userId });
      if (r.managerId) await this.notifications.send({ topic: 'orgchart', kind: 'update', title: `${r.name} now reports to you`, body: "You'll get their leave, overtime and claim requests to approve.", employeeIds: [r.managerId], actorId: user.userId });
    }
    return { reportsTo: r.manager };
  }

  @Get(':id/activity')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'employeeActivity', summary: "What was changed on this person's record, by whom and when (newest first)" })
  async activity(@Param('id') id: string) {
    const e = await this.employees.profile(id);
    const rows = await this.audit.forEntity('Employee', id, 200);
    const kind = (a: string) => (/CREATED|ADDED|REGISTERED/.test(a) ? 'Created' : /VIEW|OPENED|REVEAL/.test(a) ? 'Viewed' : /UPLOAD/.test(a) ? 'Uploaded' : /VERIF/.test(a) ? 'Verified' : /REMOVED|DELETED|ARCHIV/.test(a) ? 'Deleted' : /SEPARAT|ENROLL|RECORDED/.test(a) ? 'Recorded' : 'Edited');
    const label = (a: string) => a.replace(/^EMPLOYEE_/, '').toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    // Plain words for HR: "Reports to: Kenneth Abella → Carlo Dizon", not "reportsTo: Carlo Dizon".
    // Short forms people write in capitals stay that way (HMO, CPD, TIN…).
    const ACRONYMS = /\b(hmo|cpd|tin|sss|id|prc|bir|coe|awol|ot|nbi|psa)\b/g;
    const field = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(ACRONYMS, (w) => w.toUpperCase()).replace(/^./, (c) => c.toUpperCase());
    // Enum values (MARRIED, ON_LEAVE) read as words; short capitals (HMO, SSS) are names and stay as they are.
    const value = (x: unknown) => (x === null || x === undefined || x === '' ? 'none' : /^[A-Z]+(_[A-Z]+)*$/.test(String(x)) && String(x).length > 4 ? field(String(x).toLowerCase().replace(/_/g, ' ')) : String(x));
    const flat = (v: unknown) =>
      v && typeof v === 'object' ? Object.entries(v as Record<string, unknown>).filter(([, x]) => x === null || typeof x !== 'object') : [];
    const line = (before: unknown, after: unknown) => {
      const was = new Map(flat(before));
      const now = flat(after);
      if (!now.length) return was.size ? `Was ${[...was].map(([k, x]) => `${field(k)}: ${value(x)}`).join(' · ')}` : '';
      return now
        .filter(([, x]) => x !== null && x !== undefined)
        .map(([k, x]) => (was.has(k) && was.get(k) !== x ? `${field(k)}: ${value(was.get(k))} → ${value(x)}` : `${field(k)}: ${value(x)}`))
        .join(' · ');
    };
    return rows.map((r) => ({ id: r.id, employeeId: e.employeeNo, actor: r.actor?.displayName ?? 'System', action: kind(r.action), section: label(r.action), summary: line(r.before, r.after).slice(0, 240), at: r.at.toISOString() }));
  }

  @Post(':id/biometric-enrollment')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'enrollBiometrics',
    summary:
      'Record face/fingerprint enrollment. Refused until the signed biometric consent is on file.',
  })
  @ApiZodResponse(BiometricEnrollmentSchema, 201)
  @ApiResponse({ status: 409, description: 'Biometric consent form is not on file' })
  async enrollBiometrics(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<BiometricEnrollment> {
    // Consent first (Data Privacy Act): no enrollment without the signed consent in the 201 file.
    if (!(await this.documents.hasCurrent(id, 'BIOMETRIC_CONSENT')))
      throw new ConflictException(
        'The biometric consent form is not on file. Upload the signed consent in the 201 file first.',
      );
    const enrolledAt = await this.employees.markBiometricEnrolled(id, user.userId);
    return { employeeId: id, enrolledAt: enrolledAt.toISOString() };
  }
}
