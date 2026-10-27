import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addDays,
  CreditAdjustmentInput,
  CreditAdjustmentInputSchema,
  LeaveAdjustmentViewSchema,
  LeaveStateSchema,
  LeaveTypeViewSchema,
  SaveLeaveType,
  SaveLeaveTypeSchema,
  SetActiveSchema,
  LeaveOverview,
  LeaveOverviewQuery,
  LeaveOverviewQuerySchema,
  LeaveOverviewSchema,
  manilaToday,
} from '@msma/shared';
import {
  AuthUser,
  CurrentUser,
  isHrLike,
  requireEmployeeId,
  Roles,
} from '../common/auth.decorators';
import { ApiZodBody, ApiZodQuery, ApiZodResponse, ZodPipe } from '../common/zod';
import { z } from 'zod';
import { LeaveAdminService } from './leave-admin.service';
import { EmployeesService } from '../employees/employees.service';
import { LeaveService } from './leave.service';

/** How far ahead the Leave page looks. */
const LOOKAHEAD_DAYS = 30;

@ApiTags('leave')
@ApiBearerAuth()
@Roles('HR_ADMIN', 'SYSTEM_ADMIN', 'MANAGER')
@Controller('leave')
export class LeaveController {
  constructor(
    private readonly leave: LeaveService,
    private readonly employees: EmployeesService,
    private readonly admin: LeaveAdminService,
  ) {}

  @Get('overview')
  @ApiOperation({
    operationId: 'getLeaveOverview',
    summary: 'Who is on leave in the next 30 days, and leave days left (managers: their team)',
  })
  @ApiZodQuery(LeaveOverviewQuerySchema)
  @ApiZodResponse(LeaveOverviewSchema)
  async overview(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(LeaveOverviewQuerySchema)) q: LeaveOverviewQuery,
  ): Promise<LeaveOverview> {
    const directory = await this.employees.directory(q.siteId);
    const team = isHrLike(user.role)
      ? null
      : new Set(await this.employees.teamIds(requireEmployeeId(user)));
    const ids = [...directory.keys()].filter((id) => !team || team.has(id));
    const from = manilaToday();
    const to = addDays(from, LOOKAHEAD_DAYS);
    const { upcoming, remaining } = await this.leave.overview(ids, from, to);
    const person = (id: string) => {
      const d = directory.get(id)!;
      return { id, fullName: d.name, siteName: d.siteName };
    };
    return {
      from,
      to,
      upcoming: upcoming.map(({ employeeId, ...r }) => ({ ...r, employee: person(employeeId) })),
      balances: ids
        .map((id) => ({ employee: person(id), remaining: remaining.get(id) ?? {} }))
        .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName)),
    };
  }

  // ---------- Maintenance > Leave on the website ----------

  @Get('state')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'getLeaveState',
    summary: 'Leave types, requests and VL/SL changes for the website to show balances (HR: everyone; managers: their team; others: themselves)',
  })
  @ApiZodResponse(LeaveStateSchema)
  async state(@CurrentUser() user: AuthUser) {
    const team = user.role === 'MANAGER' && user.employeeId ? await this.employees.teamIds(user.employeeId) : undefined;
    return this.admin.state(user, team);
  }

  @Get('types')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'listLeaveTypes', summary: 'Leave types with their rules' })
  @ApiZodResponse(z.array(LeaveTypeViewSchema))
  types() {
    return this.admin.types();
  }

  @Post('types')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'saveLeaveType', summary: 'Add a leave type, or change one (with its id)' })
  @ApiZodBody(SaveLeaveTypeSchema)
  @ApiZodResponse(LeaveTypeViewSchema, 201)
  saveType(@CurrentUser() user: AuthUser, @Body(new ZodPipe(SaveLeaveTypeSchema)) body: SaveLeaveType) {
    return this.admin.saveType(body, user);
  }

  @Put('types/:id/active')
  @HttpCode(204)
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'setLeaveTypeActive', summary: 'Turn a leave type off (no new requests) or back on' })
  @ApiZodBody(SetActiveSchema)
  async setActive(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(SetActiveSchema)) body: { active: boolean }) {
    await this.admin.setTypeActive(id, body.active, user);
  }

  @Post('credits')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'adjustLeaveCredits', summary: 'Add or take away VL/SL days (half days allowed), with the reason' })
  @ApiZodBody(CreditAdjustmentInputSchema)
  @ApiZodResponse(LeaveAdjustmentViewSchema, 201)
  adjustCredits(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreditAdjustmentInputSchema)) body: CreditAdjustmentInput) {
    return this.admin.adjustCredits(body, user);
  }
}
