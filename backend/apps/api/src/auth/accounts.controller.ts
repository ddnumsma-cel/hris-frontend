import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AccountRoleSchema,
  AccountRowSchema,
  AccountStatusSchema,
  ChangePassword,
  ChangePasswordSchema,
  CreateAccount,
  CreateAccountSchema,
  TempPasswordSchema,
  WebRoleId,
} from '@msma/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { AccountsService } from './accounts.service';
import { AuthService } from './auth.service';

@ApiTags('accounts')
@ApiBearerAuth()
@Roles('PLATFORM_ADMIN', 'SYSTEM_ADMIN')
@Controller()
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly auth: AuthService,
  ) {}

  @Get('admin/accounts')
  @ApiOperation({ operationId: 'listAccounts', summary: 'Every sign-in account, with role, status and lockout (no passwords)' })
  @ApiZodResponse(z.array(AccountRowSchema))
  list() {
    return this.accounts.list();
  }

  @Get('admin/accounts/people')
  @ApiOperation({ operationId: 'employeesWithoutAccount', summary: 'Current employees with no login yet (name and work email only)' })
  people() {
    return this.accounts.withoutAccount();
  }

  @Post('admin/accounts')
  @ApiOperation({ operationId: 'addAccount', summary: 'Add a login with a temporary password (shown once)' })
  @ApiZodBody(CreateAccountSchema)
  @ApiZodResponse(TempPasswordSchema, 201)
  @ApiResponse({ status: 409, description: 'Username taken, person already has a login, or ADMIN_LIMIT_REACHED' })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateAccountSchema)) body: CreateAccount) {
    return this.accounts.create(body, user);
  }

  @Put('admin/accounts/:id/role')
  @HttpCode(204)
  @ApiOperation({ operationId: 'setAccountRole', summary: 'Give an account another role (not your own; a Super Admin always remains)' })
  @ApiZodBody(AccountRoleSchema)
  async role(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(AccountRoleSchema)) body: { roleId: WebRoleId }) {
    await this.accounts.setRole(id, body.roleId, user);
  }

  @Put('admin/accounts/:id/status')
  @HttpCode(204)
  @ApiOperation({ operationId: 'setAccountStatus', summary: 'Turn an account off (it can no longer sign in) or back on' })
  @ApiZodBody(AccountStatusSchema)
  async status(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(AccountStatusSchema)) body: { status: 'active' | 'disabled' }) {
    await this.accounts.setStatus(id, body.status, user);
  }

  @Post('admin/accounts/:id/unlock')
  @HttpCode(204)
  @ApiOperation({ operationId: 'unlockAccount', summary: 'Clear the lockout after too many wrong passwords' })
  async unlock(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.accounts.unlock(id, user);
  }

  @Post('admin/accounts/:id/reset-password')
  @HttpCode(200)
  @ApiOperation({ operationId: 'resetPassword', summary: 'A new temporary password (shown once); they choose their own at the next sign-in' })
  @ApiZodResponse(TempPasswordSchema)
  reset(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accounts.resetPassword(id, user);
  }

  @Post('auth/change-password')
  @HttpCode(200)
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ operationId: 'changePassword', summary: 'Change your own password (replaces a temporary one)' })
  @ApiZodBody(ChangePasswordSchema)
  async changePassword(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ChangePasswordSchema)) body: ChangePassword) {
    await this.accounts.changeOwnPassword(user, body.currentPassword, body.newPassword);
    // Sessions started before the change end; this one carries on with a fresh token.
    return { accessToken: await this.auth.tokenFor(user.userId) };
  }
}
