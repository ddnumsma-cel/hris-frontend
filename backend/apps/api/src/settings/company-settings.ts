import { Body, Controller, Get, Injectable, Module, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CompanySettings,
  CompanySettingsSchema,
  LeavePolicyInput,
  LeavePolicyInputSchema,
  SchedulingRulesInput,
  SchedulingRulesInputSchema,
} from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';

/** The website's defaults (lib/admin/store.ts DEFAULT_SETTINGS), until the Super Admin saves their own. */
export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'MSMA Group',
  tin: '',
  address: 'Cebu City, Cebu',
  contactEmail: 'hr@msma.ph',
  minPasswordLength: 8,
  lockAfterFailed: 5,
  lockMinutes: 15,
  idleMinutes: 30,
  logo: '',
  defaultTimezone: 'Asia/Manila',
  currency: 'PHP',
  workWeek: [1, 2, 3, 4, 5],
  workStart: '08:30',
  workEnd: '17:30',
  fiscalYearStartMonth: 1,
  retentionMonths: 0,
};
export const DEFAULT_SCHEDULING: SchedulingRulesInput = { overtimeThresholdMinutes: 0, defaultBreakMinutes: 60, publishLeadDays: 7 };
export const DEFAULT_LEAVE_POLICY_SETTING: LeavePolicyInput = { allowHalfDays: true, allowNegative: false, defaultCarryOver: 0, accrual: 'yearly' };

const KEYS = { company: 'company-settings', scheduling: 'scheduling-rules', leave: 'leave-policy' } as const;

/**
 * Company-wide settings kept on the backend (they were only in each browser before): company details and sign-in
 * rules (Admin settings › Organization), scheduling rules and the leave policy (Rules). Each change is audited.
 */
@Injectable()
export class CompanySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async read<T extends object>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return { ...fallback, ...((row?.value as Partial<T> | null) ?? {}) };
  }

  private async write<T extends object>(key: string, value: T, user: AuthUser, action: string, before: T) {
    await this.prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } });
      // The logo is a picture: the audit row records only whether it changed.
      const strip = (v: T) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'logo' ? (x ? '(set)' : '') : x]));
      await this.audit.log({ actorId: user.userId, action, entity: 'Settings', entityId: key, before: strip(before), after: strip(value) }, tx);
    });
    return value;
  }

  company = () => this.read(KEYS.company, DEFAULT_COMPANY_SETTINGS);
  scheduling = () => this.read(KEYS.scheduling, DEFAULT_SCHEDULING);
  leavePolicy = () => this.read(KEYS.leave, DEFAULT_LEAVE_POLICY_SETTING);

  async saveCompany(input: CompanySettings, user: AuthUser) {
    return this.write(KEYS.company, input, user, 'COMPANY_SETTINGS_CHANGED', await this.company());
  }
  async saveScheduling(input: SchedulingRulesInput, user: AuthUser) {
    return this.write(KEYS.scheduling, input, user, 'SCHEDULING_RULES_CHANGED', await this.scheduling());
  }
  async saveLeavePolicy(input: LeavePolicyInput, user: AuthUser) {
    return this.write(KEYS.leave, input, user, 'LEAVE_POLICY_CHANGED', await this.leavePolicy());
  }
}

@ApiTags('settings')
@ApiBearerAuth()
@Controller()
export class CompanySettingsController {
  constructor(private readonly settings: CompanySettingsService) {}

  @Get('settings')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ operationId: 'companySettings', summary: 'Company details and sign-in rules (everyone signed in reads them)' })
  company() {
    return this.settings.company();
  }

  @Put('admin/settings')
  @Roles('SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'saveCompanySettings', summary: 'Super Admin: change company details and sign-in rules' })
  @ApiZodBody(CompanySettingsSchema)
  saveCompany(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CompanySettingsSchema)) body: CompanySettings) {
    return this.settings.saveCompany(body, user);
  }

  @Get('settings/scheduling')
  @Roles('MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'schedulingRules', summary: 'Overtime threshold, default break, schedule lead time' })
  scheduling() {
    return this.settings.scheduling();
  }

  @Put('settings/scheduling')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'saveSchedulingRules', summary: 'Change the scheduling rules' })
  @ApiZodBody(SchedulingRulesInputSchema)
  saveScheduling(@CurrentUser() user: AuthUser, @Body(new ZodPipe(SchedulingRulesInputSchema)) body: SchedulingRulesInput) {
    return this.settings.saveScheduling(body, user);
  }

  @Put('settings/leave-policy')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'saveLeavePolicy', summary: 'Half days, negative balance, default carry-over, accrual' })
  @ApiZodBody(LeavePolicyInputSchema)
  saveLeavePolicy(@CurrentUser() user: AuthUser, @Body(new ZodPipe(LeavePolicyInputSchema)) body: LeavePolicyInput) {
    return this.settings.saveLeavePolicy(body, user);
  }
}

@Module({ controllers: [CompanySettingsController], providers: [CompanySettingsService], exports: [CompanySettingsService] })
export class CompanySettingsModule {}
