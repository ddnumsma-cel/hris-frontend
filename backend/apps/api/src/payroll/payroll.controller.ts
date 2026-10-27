import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApprovePayRun,
  ApprovePayRunSchema,
  CreatePayRun,
  CreatePayRunSchema,
  PayrollPersonSchema,
  PayrollPreviewQuery,
  PayrollPreviewQuerySchema,
  PayrollPreviewSchema,
  PayRunSchema,
  UpdatePayRun,
  UpdatePayRunSchema,
} from '@msma/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodQuery, ApiZodResponse, ZodPipe } from '../common/zod';
import { PayrollRunsService } from './payroll-runs.service';
import { PayrollService } from './payroll.service';

@ApiTags('payroll')
@ApiBearerAuth()
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payroll: PayrollService,
    private readonly runs: PayrollRunsService,
  ) {}

  @Post('preview')
  @HttpCode(200)
  @Roles('PAYROLL_ADMIN', 'HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'previewPayroll',
    summary:
      'SAMPLE ONLY: payroll preview for a cutoff (rates approximate, marked verified: false)',
  })
  @ApiZodQuery(PayrollPreviewQuerySchema)
  @ApiZodResponse(PayrollPreviewSchema)
  preview(@Query(new ZodPipe(PayrollPreviewQuerySchema)) q: PayrollPreviewQuery) {
    return this.payroll.preview(q.cutoff, q.siteId);
  }

  // ---------- Runs made on the website (it works the pay out; these keep and lock them) ----------

  @Get('people')
  @Roles('PAYROLL_ADMIN', 'HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'listPayrollPeople', summary: 'Everyone on payroll, with salary, dates and government numbers' })
  @ApiZodResponse(z.array(PayrollPersonSchema))
  people() {
    return this.runs.people();
  }

  @Get('runs')
  @ApiOperation({
    operationId: 'listPayRuns',
    summary: 'Payroll runs, newest first',
    description: 'Accounting and Super Admin see every run. Everyone else gets approved runs with only their own line (their payslips).',
  })
  @ApiZodResponse(z.array(PayRunSchema))
  list(@CurrentUser() user: AuthUser) {
    return this.runs.list(user);
  }

  @Get('runs/:id')
  @Roles('PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'getPayRun', summary: 'One payroll run' })
  @ApiZodResponse(PayRunSchema)
  get(@Param('id') id: string) {
    return this.runs.get(id);
  }

  @Post('runs')
  @Roles('PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'createPayRun', summary: 'Start a payroll run for a cut-off with the pay worked out on the website' })
  @ApiZodBody(CreatePayRunSchema)
  @ApiZodResponse(PayRunSchema, 201)
  @ApiResponse({ status: 409, description: 'A run already covers some of these days' })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreatePayRunSchema)) body: CreatePayRun) {
    return this.runs.create(body, user);
  }

  @Put('runs/:id')
  @Roles('PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'updatePayRun', summary: 'Save a draft worked out again (latest attendance, adjustments added or removed)' })
  @ApiZodBody(UpdatePayRunSchema)
  @ApiZodResponse(PayRunSchema)
  @ApiResponse({ status: 409, description: 'The run is approved and locked' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(UpdatePayRunSchema)) body: UpdatePayRun) {
    return this.runs.update(id, body, user);
  }

  @Post('runs/:id/review')
  @HttpCode(200)
  @Roles('PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'reviewPayRun', summary: 'Sign off a draft as reviewed' })
  @ApiZodResponse(PayRunSchema)
  review(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.runs.review(id, user);
  }

  @Post('runs/:id/approve')
  @HttpCode(200)
  @Roles('PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'approvePayRun', summary: 'Final approval: lock the run as shown and release the payslips' })
  @ApiZodBody(ApprovePayRunSchema)
  @ApiZodResponse(PayRunSchema)
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ApprovePayRunSchema)) body: ApprovePayRun) {
    return this.runs.approve(id, body, user);
  }

  @Delete('runs/:id')
  @HttpCode(204)
  @Roles('PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'deletePayRun', summary: 'Delete a draft run (approved runs stay on record)' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.runs.remove(id, user);
  }
}
