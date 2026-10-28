import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CancelLeave, CancelLeaveSchema, FileLeaveFor, FileLeaveForSchema } from '@msma/shared';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../common/zod';
import { ApprovalsService } from './approvals.service';

/** Leave › withdraw or cancel a request, and the Super Admin's "File leave" for someone. */
@ApiTags('leave')
@ApiBearerAuth()
@Controller('leave/requests')
export class LeaveRequestsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Post()
  @Roles('SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'fileLeaveFor', summary: 'Super Admin: file leave for an employee, approved at once if asked' })
  @ApiZodBody(FileLeaveForSchema)
  fileFor(@CurrentUser() user: AuthUser, @Body(new ZodPipe(FileLeaveForSchema)) body: FileLeaveFor) {
    return this.approvals.fileLeaveFor(user, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'cancelLeave', summary: 'Withdraw your own leave, or cancel your team member’s (approved leave only before it starts)' })
  @ApiZodBody(CancelLeaveSchema)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(CancelLeaveSchema)) body: CancelLeave) {
    return this.approvals.cancelLeave(user, id, body.note);
  }
}
