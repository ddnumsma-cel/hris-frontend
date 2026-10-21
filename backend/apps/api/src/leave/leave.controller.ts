import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addDays,
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
import { ApiZodQuery, ApiZodResponse, ZodPipe } from '../common/zod';
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
}
