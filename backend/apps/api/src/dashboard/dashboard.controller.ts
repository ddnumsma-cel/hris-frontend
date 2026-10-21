import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardQuery, DashboardQuerySchema, DashboardSummarySchema } from '@msma/shared';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodQuery, ApiZodResponse, ZodPipe } from '../common/zod';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN', 'MANAGER')
  @ApiOperation({
    operationId: 'getDashboardSummary',
    summary: 'KPIs, attendance trend, live punches, terminals and payroll preview',
  })
  @ApiZodQuery(DashboardQuerySchema)
  @ApiZodResponse(DashboardSummarySchema)
  summary(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(DashboardQuerySchema)) q: DashboardQuery,
  ) {
    return this.dashboard.summary(user, q);
  }
}
