import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApprovalItemSchema,
  ApprovalListQuery,
  ApprovalListQuerySchema,
  ApprovalListResponseSchema,
  ApproveRequest,
  ApproveRequestSchema,
  RejectRequest,
  RejectRequestSchema,
} from '@msma/shared';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodQuery, ApiZodResponse, ZodPipe } from '../common/zod';
import { ApprovalsService } from './approvals.service';

@ApiTags('approvals')
@ApiBearerAuth()
@Roles('HR_ADMIN', 'SYSTEM_ADMIN', 'MANAGER')
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @ApiOperation({
    operationId: 'listApprovals',
    summary: 'Approval requests (managers see only their team; HR sees all)',
  })
  @ApiZodQuery(ApprovalListQuerySchema)
  @ApiZodResponse(ApprovalListResponseSchema)
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(ApprovalListQuerySchema)) q: ApprovalListQuery,
  ) {
    return this.approvals.list(user, q);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'approveRequest',
    summary: 'Approve a pending request (writes an audit log entry)',
  })
  @ApiZodBody(ApproveRequestSchema)
  @ApiZodResponse(ApprovalItemSchema)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(ApproveRequestSchema)) body: ApproveRequest,
  ) {
    return this.approvals.decide(user, id, 'APPROVED', body.reason);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'rejectRequest',
    summary: 'Reject a pending request with a reason (writes an audit log entry)',
  })
  @ApiZodBody(RejectRequestSchema)
  @ApiZodResponse(ApprovalItemSchema)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(RejectRequestSchema)) body: RejectRequest,
  ) {
    return this.approvals.decide(user, id, 'REJECTED', body.reason);
  }
}
