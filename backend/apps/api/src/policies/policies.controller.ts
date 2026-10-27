import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MyPolicySchema,
  PolicyAcksSchema,
  PolicyInput,
  PolicyInputSchema,
  PolicyRowSchema,
  PolicySchema,
  PolicyStatusSchema,
} from '@msma/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { PoliciesService } from './policies.service';

@ApiTags('policies')
@ApiBearerAuth()
@Roles('HR_ADMIN', 'SYSTEM_ADMIN')
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  @ApiOperation({ operationId: 'listPolicies', summary: 'Every policy, with how many current employees confirmed reading it' })
  @ApiZodResponse(z.array(PolicyRowSchema))
  list() {
    return this.policies.list();
  }

  @Get('mine')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'myPolicies', summary: 'Published policies for the signed-in employee, the ones still to confirm first' })
  @ApiZodResponse(z.array(MyPolicySchema))
  mine(@CurrentUser() user: AuthUser) {
    return this.policies.mine(user);
  }

  @Post()
  @ApiOperation({ operationId: 'addPolicy', summary: 'Write a new policy (a draft until published)' })
  @ApiZodBody(PolicyInputSchema)
  @ApiZodResponse(PolicySchema, 201)
  add(@CurrentUser() user: AuthUser, @Body(new ZodPipe(PolicyInputSchema)) body: PolicyInput) {
    return this.policies.save(undefined, body, user);
  }

  @Put(':id')
  @ApiOperation({ operationId: 'changePolicy', summary: 'Change a policy; new content on a published one makes a new version to confirm again' })
  @ApiZodBody(PolicyInputSchema)
  @ApiZodResponse(PolicySchema)
  change(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(PolicyInputSchema)) body: PolicyInput) {
    return this.policies.save(id, body, user);
  }

  @Put(':id/status')
  @HttpCode(204)
  @ApiOperation({ operationId: 'setPolicyStatus', summary: 'Publish, archive or return a policy to draft' })
  @ApiZodBody(PolicyStatusSchema)
  async status(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(PolicyStatusSchema)) body: { status: 'draft' | 'published' | 'archived' }) {
    await this.policies.setStatus(id, body.status, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'deletePolicy', summary: 'Delete a draft policy' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.policies.remove(id, user);
  }

  @Get(':id/acknowledgements')
  @ApiOperation({ operationId: 'policyAcknowledgements', summary: 'Who has and has not confirmed the current version' })
  @ApiZodResponse(PolicyAcksSchema)
  acknowledgements(@Param('id') id: string) {
    return this.policies.acknowledgements(id);
  }

  @Post(':id/acknowledge')
  @HttpCode(204)
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'acknowledgePolicy', summary: 'The signed-in employee confirms reading the current version' })
  async acknowledge(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.policies.acknowledge(id, user);
  }
}
