import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ClockRequest,
  ClockRequestSchema,
  ClockResponse,
  ClockResponseSchema,
  CreateLeaveRequest,
  CreateLeaveRequestSchema,
  CreateOvertimeRequest,
  CreateOvertimeRequestSchema,
  CreateTimeAdjustment,
  CreateTimeAdjustmentSchema,
  CreateUndertimeRequest,
  CreateUndertimeRequestSchema,
  DtrRowSchema,
  formatTime,
  LeaveBalanceSchema,
  MeTodaySchema,
  MyRequestSchema,
  PayslipViewSchema,
  SessionUserSchema,
  UpdatePreferences,
  UpdatePreferencesSchema,
} from '@msma/shared';
import { z } from 'zod';
import { ApprovalsService } from '../approvals/approvals.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AuthService } from '../auth/auth.service';
import { AuthUser, CurrentUser, requireEmployeeId } from '../common/auth.decorators';
import { config } from '../config';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { MOBILE_DEVICE_SERIAL } from '../devices/devices.service';
import { EmployeesService } from '../employees/employees.service';
import { LeaveService } from '../leave/leave.service';
import { PayrollService } from '../payroll/payroll.service';

/** Minimum gap between two clock actions, to absorb double taps. */
const CLOCK_DEBOUNCE_MS = 60_000;

/** Employee self-service endpoints used by the mobile app. Any signed-in user linked to an employee. */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly leave: LeaveService,
    private readonly approvals: ApprovalsService,
    private readonly payroll: PayrollService,
    private readonly auth: AuthService,
    private readonly employees: EmployeesService,
  ) {}

  @Get('profile')
  @ApiOperation({
    operationId: 'getMyProfile',
    summary: 'My own employee record (the website shows it as "me": greeting, 201 file, account settings)',
    description: 'Same shape as GET /employees/:id, for the signed-in person only. 404 when the login has no employee record.',
  })
  async profile(@CurrentUser() user: AuthUser) {
    const id = requireEmployeeId(user);
    const [profile, personal] = await Promise.all([this.employees.profile(id), this.employees.personal(id)]);
    return { ...profile, personal };
  }

  @Get('today')
  @ApiOperation({
    operationId: 'getMyToday',
    summary: "Today's shift, time in/out and clock status",
  })
  @ApiZodResponse(MeTodaySchema)
  today(@CurrentUser() user: AuthUser) {
    return this.attendance.today(requireEmployeeId(user));
  }

  @Get('attendance')
  @ApiOperation({ operationId: 'getMyAttendance', summary: 'My last 14 daily time records' })
  @ApiZodResponse(z.array(DtrRowSchema))
  attendanceHistory(@CurrentUser() user: AuthUser) {
    return this.attendance.recentDtrs(requireEmployeeId(user), 14);
  }

  @Post('clock')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'clock',
    summary: "Clock in/out from the phone, confirmed with the phone's fingerprint, face or PIN",
    description:
      'Temporary until the attendance machines are in use (PHONE_CLOCK_ENABLED). The phone checks its owner; ' +
      'no fingerprint or face data reaches MSMA. The punch records how the phone was unlocked.',
  })
  @ApiZodBody(ClockRequestSchema)
  @ApiZodResponse(ClockResponseSchema)
  async clock(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(ClockRequestSchema)) body: ClockRequest,
  ): Promise<ClockResponse> {
    const employeeId = requireEmployeeId(user);
    if (!config.phoneClockEnabled) {
      throw new ForbiddenException(
        'Clocking in from the phone is switched off. Please use the attendance machine at your site.',
      );
    }
    const before = await this.attendance.today(employeeId);
    const last = await this.attendance.lastPunchAt(employeeId);
    const now = new Date();
    if (last && now.getTime() - last.getTime() < CLOCK_DEBOUNCE_MS) {
      throw new ConflictException(
        `You already clocked at ${formatTime(last)}. Please wait a minute before trying again.`,
      );
    }
    // The phone confirms its owner (fingerprint / face / PIN) before sending this; the API trusts that result.
    // Good enough for testing; see docs/adr/0003-attendance-devices.md for what production needs.
    await this.attendance.recordPunches([
      {
        employeeId,
        deviceSerial: MOBILE_DEVICE_SERIAL,
        punchedAt: now,
        verifyMode: body.phoneCheck,
      },
    ]);
    return {
      punchedAt: now.toISOString(),
      action: before.nextAction,
      today: await this.attendance.today(employeeId),
    };
  }

  @Get('leave-balances')
  @ApiOperation({ operationId: 'getMyLeaveBalances', summary: 'My leave balances for this year' })
  @ApiZodResponse(z.array(LeaveBalanceSchema))
  leaveBalances(@CurrentUser() user: AuthUser) {
    return this.leave.balances(requireEmployeeId(user));
  }

  @Post('leave-requests')
  @ApiOperation({
    operationId: 'fileLeave',
    summary: 'File a leave request (goes to my manager / HR for approval)',
  })
  @ApiZodBody(CreateLeaveRequestSchema)
  @ApiZodResponse(MyRequestSchema, 201)
  fileLeave(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreateLeaveRequestSchema)) body: CreateLeaveRequest,
  ) {
    return this.approvals.submitLeave(user, body);
  }

  @Post('overtime-requests')
  @ApiOperation({
    operationId: 'fileOvertime',
    summary: 'File overtime (before or after working it; only approved overtime is paid)',
  })
  @ApiZodBody(CreateOvertimeRequestSchema)
  @ApiZodResponse(MyRequestSchema, 201)
  fileOvertime(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreateOvertimeRequestSchema)) body: CreateOvertimeRequest,
  ) {
    return this.approvals.submitOvertime(user, body);
  }

  @Post('undertime-requests')
  @ApiOperation({
    operationId: 'fileUndertime',
    summary: 'Ask to leave before the shift ends (the early minutes stay unpaid)',
  })
  @ApiZodBody(CreateUndertimeRequestSchema)
  @ApiZodResponse(MyRequestSchema, 201)
  fileUndertime(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreateUndertimeRequestSchema)) body: CreateUndertimeRequest,
  ) {
    return this.approvals.submitUndertime(user, body);
  }

  @Post('time-adjustments')
  @ApiOperation({
    operationId: 'fileTimeAdjustment',
    summary: 'Ask to correct a missing or wrong time in / time out (approval updates the DTR)',
  })
  @ApiZodBody(CreateTimeAdjustmentSchema)
  @ApiZodResponse(MyRequestSchema, 201)
  fileTimeAdjustment(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreateTimeAdjustmentSchema)) body: CreateTimeAdjustment,
  ) {
    return this.approvals.submitTimeAdjustment(user, body);
  }

  @Get('requests')
  @ApiOperation({
    operationId: 'getMyRequests',
    summary: 'My leave, overtime, undertime and time adjustment requests with status',
  })
  @ApiZodResponse(z.array(MyRequestSchema))
  requests(@CurrentUser() user: AuthUser) {
    return this.approvals.myRequests(requireEmployeeId(user));
  }

  @Get('payslips/latest')
  @ApiOperation({ operationId: 'getMyLatestPayslip', summary: 'My latest released payslip' })
  @ApiZodResponse(PayslipViewSchema)
  latestPayslip(@CurrentUser() user: AuthUser) {
    return this.payroll.latestPayslip(requireEmployeeId(user));
  }

  @Patch('preferences')
  @ApiOperation({
    operationId: 'updateMyPreferences',
    summary: 'Theme (Light / Dark / Match my device), text size and table density',
  })
  @ApiZodBody(UpdatePreferencesSchema)
  @ApiZodResponse(SessionUserSchema)
  preferences(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(UpdatePreferencesSchema)) body: UpdatePreferences,
  ) {
    return this.auth.updatePreferences(user.userId, body);
  }
}
