import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClaimDecisionSchema, ClaimInput, ClaimInputSchema, ClaimPay, ClaimPaySchema, ClaimSchema } from '@msma/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { ClaimsService } from './claims.service';

@ApiTags('requests')
@ApiBearerAuth()
@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
@Controller('reimbursements/claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get()
  @ApiOperation({ operationId: 'listClaims', summary: 'Claims: your own; an Approver also their team; Accounting and the Super Admin everyone' })
  @ApiZodResponse(z.array(ClaimSchema))
  list(@CurrentUser() user: AuthUser) {
    return this.claims.list(user);
  }

  @Post()
  @ApiOperation({ operationId: 'fileClaim', summary: 'File a reimbursement claim with the receipt photo' })
  @ApiZodBody(ClaimInputSchema)
  @ApiZodResponse(ClaimSchema, 201)
  file(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ClaimInputSchema)) body: ClaimInput) {
    return this.claims.file(body, user);
  }

  @Post(':id/decision')
  @HttpCode(200)
  @Roles('MANAGER', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'decideClaim', summary: 'Approver endorses (or declines); then Accounting gives the final approval (or declines)' })
  @ApiZodBody(ClaimDecisionSchema)
  @ApiZodResponse(ClaimSchema)
  decide(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ClaimDecisionSchema)) body: { approve: boolean; note: string }) {
    return this.claims.decide(id, body.approve, body.note, user);
  }

  @Post('pay')
  @HttpCode(200)
  @Roles('PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'releaseClaims', summary: 'Release approved claims to the employees: cash, bank transfer, e-wallet or check' })
  @ApiZodBody(ClaimPaySchema)
  pay(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ClaimPaySchema)) body: ClaimPay) {
    return this.claims.pay(body, user);
  }
}
