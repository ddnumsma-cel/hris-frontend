import {
  Body,
  ConflictException,
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
  UpdatePersonalInfo,
  UpdatePersonalInfoSchema,
} from '@msma/shared';
import { AttendanceService } from '../attendance/attendance.service';
import { AuthUser, canSeePay, CurrentUser, isHrLike, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodQuery, ApiZodResponse, ZodPipe } from '../common/zod';
import { DocumentsService } from '../documents/documents.service';
import { LeaveService } from '../leave/leave.service';
import { EmployeesService } from './employees.service';

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
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreateEmployeeSchema)) body: CreateEmployee,
  ) {
    return this.employees.create(body, user.userId);
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
