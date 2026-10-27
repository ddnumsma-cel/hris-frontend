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

const mask = (v: string) => v.replace(/\d(?=[\d-]{4})/g, '•');

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
  ) {}

  /** Managers only see their direct reports. */
  private async scope(user: AuthUser): Promise<string[] | undefined> {
    return user.role === 'MANAGER' && user.employeeId
      ? this.employees.teamIds(user.employeeId)
      : undefined;
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
    // Government IDs are sensitive: only HR, payroll and system admins see them in full.
    const showIds = isHrLike(user.role) || user.role === 'PAYROLL_ADMIN';
    const govIds =
      profile.govIds && !showIds
        ? {
            tin: mask(profile.govIds.tin),
            sss: mask(profile.govIds.sss),
            philhealth: mask(profile.govIds.philhealth),
            pagibig: mask(profile.govIds.pagibig),
          }
        : profile.govIds;
    // Personal data sheet (address, dependents, emergency contact): HR, System Admin and the employee only.
    const showPersonal = isHrLike(user.role) || user.employeeId === id;
    return {
      ...profile,
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
