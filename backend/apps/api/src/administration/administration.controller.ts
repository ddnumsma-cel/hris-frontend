import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AuditRowSchema,
  ChangePlanSchema,
  ExtensionSchema,
  FileTicket,
  FileTicketSchema,
  SeatOverrideSchema,
  TicketPatch,
  TicketPatchSchema,
  TicketReplySchema,
  TicketSchema,
  UpgradeRequestSchema,
  UsageSchema,
} from '@msma/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { isPlatformAdmin } from '../common/platform';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { AuditTrailService } from './audit-trail.service';
import { SubscriptionService } from './subscription.service';
import { SupportService } from './support.service';

const EVERYONE = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN', 'PLATFORM_ADMIN'] as const;
/** The IT team's System Admin account only (role PLATFORM_ADMIN). */
const platformOnly = (user: AuthUser) => {
  if (!isPlatformAdmin(user)) throw new ForbiddenException('Only our support team can do this');
};

@ApiTags('administration')
@ApiBearerAuth()
@Controller()
export class AdministrationController {
  constructor(
    private readonly audit: AuditTrailService,
    private readonly support: SupportService,
    private readonly subscription: SubscriptionService,
  ) {}

  // ---------- Audit trail ----------

  @Get('admin/audit')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN', 'PAYROLL_ADMIN')
  @ApiOperation({ operationId: 'auditTrail', summary: 'Everything recorded, newest first (Accounting: Payroll only)' })
  @ApiZodResponse(z.array(AuditRowSchema))
  auditTrail(@CurrentUser() user: AuthUser) {
    return this.audit.rows(user);
  }

  // ---------- Support tickets ----------

  @Get('support/tickets')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'listTickets', summary: 'Support tickets you may see (the HR workspace shares its own)' })
  @ApiZodResponse(z.array(TicketSchema))
  tickets(@CurrentUser() user: AuthUser) {
    return this.support.list(user);
  }

  @Post('support/tickets')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'fileTicket', summary: 'Report a problem or ask for help' })
  @ApiZodBody(FileTicketSchema)
  @ApiZodResponse(TicketSchema, 201)
  file(@CurrentUser() user: AuthUser, @Body(new ZodPipe(FileTicketSchema)) body: FileTicket) {
    return this.support.file(body, user);
  }

  @Post('support/tickets/:id/messages')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'replyTicket', summary: 'Reply on a ticket' })
  @ApiZodBody(TicketReplySchema)
  @ApiZodResponse(TicketSchema, 201)
  reply(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(TicketReplySchema)) body: { text: string }) {
    return this.support.reply(id, body.text, user);
  }

  @Patch('support/tickets/:id')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'updateTicket', summary: 'Our support team: status, priority and who is on it' })
  @ApiZodBody(TicketPatchSchema)
  @ApiZodResponse(TicketSchema)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(TicketPatchSchema)) body: TicketPatch) {
    platformOnly(user);
    return this.support.update(id, body, user);
  }

  @Post('support/tickets/:id/close')
  @HttpCode(200)
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'closeTicket', summary: 'Close your ticket once it is sorted' })
  @ApiZodResponse(TicketSchema)
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.support.close(id, user);
  }

  // ---------- The company's subscription ----------

  @Get('subscription')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN', 'PAYROLL_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ operationId: 'getSubscription', summary: 'The plan, and employee seats and admin accounts in use (counted from the records)' })
  @ApiZodResponse(UsageSchema)
  usage() {
    return this.subscription.usage();
  }

  @Post('subscription/seat-check')
  @HttpCode(204)
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'seatCheck', summary: 'Before adding an employee: is a seat free?' })
  @ApiResponse({ status: 409, description: 'SEAT_LIMIT_REACHED' })
  async seatCheck() {
    await this.subscription.assertSeats(1);
  }

  @Post('subscription/upgrade-requests')
  @Roles('SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'requestUpgrade', summary: 'Super Admin asks our team for more seats' })
  @ApiZodBody(UpgradeRequestSchema)
  @ApiZodResponse(UsageSchema, 201)
  upgrade(@CurrentUser() user: AuthUser, @Body(new ZodPipe(UpgradeRequestSchema)) body: { note: string }) {
    return this.subscription.requestUpgrade(body.note, user.displayName);
  }

  // ---------- Clients & Subscriptions (our team) ----------

  @Get('subscription/clients')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'listClients', summary: 'Our team: each client and its seats' })
  @ApiZodResponse(z.array(UsageSchema))
  async clients(@CurrentUser() user: AuthUser) {
    platformOnly(user);
    return [await this.subscription.usage()];
  }

  @Get('subscription/plans')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'listPlans', summary: 'Our team: the plans' })
  plans(@CurrentUser() user: AuthUser) {
    platformOnly(user);
    return this.subscription.plans();
  }

  @Get('subscription/events')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'subscriptionEvents', summary: 'Our team: seat alerts, refused adds, upgrade requests, plan changes' })
  events(@CurrentUser() user: AuthUser) {
    platformOnly(user);
    return this.subscription.events();
  }

  @Put('subscription/clients/:id/plan')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'changePlan', summary: 'Our team: move a client to another plan' })
  @ApiZodBody(ChangePlanSchema)
  changePlan(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ChangePlanSchema)) body: { planId: string }) {
    platformOnly(user);
    return this.subscription.changePlan(id, body.planId, user.displayName);
  }

  @Put('subscription/clients/:id/seat-override')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'setSeatOverride', summary: "Our team: replace the plan's seat limit (null = plan limit)" })
  @ApiZodBody(SeatOverrideSchema)
  @ApiZodResponse(UsageSchema)
  override(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(SeatOverrideSchema)) body: { seats: number | null }) {
    platformOnly(user);
    return this.subscription.setOverride(id, body.seats, user.displayName);
  }

  @Put('subscription/clients/:id/extension')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'grantExtension', summary: 'Our team: temporary extra seats until a date (null ends it)' })
  @ApiZodBody(ExtensionSchema)
  @ApiZodResponse(UsageSchema)
  extension(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ExtensionSchema)) body: { extension: { seats: number; until: string } | null }) {
    platformOnly(user);
    return this.subscription.setExtension(id, body.extension, user.displayName);
  }
}
