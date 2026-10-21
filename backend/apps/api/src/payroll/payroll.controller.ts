import { Controller, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PayrollPreviewQuery, PayrollPreviewQuerySchema, PayrollPreviewSchema } from '@msma/shared';
import { Roles } from '../common/auth.decorators';
import { ApiZodQuery, ApiZodResponse, ZodPipe } from '../common/zod';
import { PayrollService } from './payroll.service';

@ApiTags('payroll')
@ApiBearerAuth()
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

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
}
