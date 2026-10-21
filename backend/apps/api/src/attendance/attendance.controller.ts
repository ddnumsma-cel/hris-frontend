import { Controller, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  RecomputeQuery,
  RecomputeQuerySchema,
  RecomputeResponse,
  RecomputeResponseSchema,
} from '@msma/shared';
import { Roles } from '../common/auth.decorators';
import { ApiZodQuery, ApiZodResponse, ZodPipe } from '../common/zod';
import { AttendanceService } from './attendance.service';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

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
