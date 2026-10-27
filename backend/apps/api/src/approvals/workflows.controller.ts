import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Workflow, WorkflowSchema } from '@msma/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { WorkflowsService } from './workflows.service';

@ApiTags('approvals')
@ApiBearerAuth()
@Controller()
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get('workflows')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'listWorkflows', summary: 'Who approves each kind of request, step by step' })
  @ApiZodResponse(z.array(WorkflowSchema))
  list() {
    return this.workflows.list();
  }

  @Put('admin/workflows')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'saveWorkflow', summary: 'Change the steps for one kind of request (new requests follow them)' })
  @ApiZodBody(WorkflowSchema)
  @ApiZodResponse(WorkflowSchema)
  save(@CurrentUser() user: AuthUser, @Body(new ZodPipe(WorkflowSchema)) body: Workflow) {
    return this.workflows.save(body, user);
  }
}
