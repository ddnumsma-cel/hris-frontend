import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AttendanceDaysQuery,
  AttendanceDaysQuerySchema,
  AttendanceDaysResponse,
  AttendanceDaysResponseSchema,
  RecomputeQuery,
  RecomputeQuerySchema,
  RecomputeResponse,
  RecomputeResponseSchema,
} from '@msma/shared';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodQuery, ApiZodResponse, ZodPipe } from '../common/zod';
import { EmployeesService } from '../employees/employees.service';
import { AttendanceService } from './attendance.service';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly employees: EmployeesService,
  ) {}

  @Get('days')
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN', 'MANAGER')
  @ApiOperation({
    operationId: 'listAttendanceDays',
    summary: 'Daily time records with the raw device punches behind them (HR attendance log)',
    description: 'At most 62 days. Managers see only their direct reports.',
  })
  @ApiZodQuery(AttendanceDaysQuerySchema)
  @ApiZodResponse(AttendanceDaysResponseSchema)
  async days(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(AttendanceDaysQuerySchema)) q: AttendanceDaysQuery,
  ): Promise<AttendanceDaysResponse> {
    const scope =
      user.role === 'MANAGER' ? (user.employeeId ? await this.employees.teamIds(user.employeeId) : []) : undefined;
    return this.attendance.days(q.from, q.to, scope, q.employeeId);
  }

  @Post('recompute')
  @HttpCode(200)
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'recomputeAttendance',
    summary: 'Recompute daily time records from raw punches for a date range',
  })
  @ApiZodQuery(RecomputeQuerySchema)
  @ApiZodResponse(RecomputeResponseSchema)
  async recompute(
    @Query(new ZodPipe(RecomputeQuerySchema)) q: RecomputeQuery,
  ): Promise<RecomputeResponse> {
    const result = await this.attendance.recompute(q.from, q.to);
    return { from: q.from, to: q.to, ...result };
  }
}
