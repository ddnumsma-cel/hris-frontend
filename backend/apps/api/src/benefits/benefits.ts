import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { seal, unseal } from '@msma/db';
import { BenefitInput, BenefitInputSchema } from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, requireEmployeeId, Roles } from '../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../common/zod';
import { EmployeesModule } from '../employees/employees.module';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../prisma/prisma.service';

const EVERYONE = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN'] as const;

/** The government memberships on the record; they are changed by HR there, not on this page. */
const GOVERNMENT = [
  { key: 'sss', id: 'gov-sss', name: 'SSS', provider: 'Social Security System' },
  { key: 'philhealth', id: 'gov-philhealth', name: 'PhilHealth', provider: 'PhilHealth' },
  { key: 'pagibig', id: 'gov-pagibig', name: 'Pag-IBIG', provider: 'HDMF' },
] as const;

type View = { id: string; name: string; provider: string; memberId: string; status: 'Active' | 'Pending' };

/**
 * Employee › HMO & Benefits: the government memberships from the person's own record, and the HMO and other
 * benefits they add themselves (pending until they confirm the enrollment). Member numbers are stored encrypted.
 */
@Injectable()
export class BenefitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
  ) {}

  private view(b: { id: string; name: string; provider: string; memberId: string; status: string }): View {
    return { id: b.id, name: b.name, provider: b.provider, memberId: unseal(b.memberId), status: b.status === 'ACTIVE' ? 'Active' : 'Pending' };
  }

  async list(employeeId: string): Promise<View[]> {
    const [profile, own] = await Promise.all([
      this.employees.profile(employeeId),
      this.prisma.employeeBenefit.findMany({ where: { employeeId, removedAt: null }, orderBy: { createdAt: 'desc' } }),
    ]);
    const gov = GOVERNMENT.flatMap((g) => {
      const no = profile.govIds?.[g.key];
      return no ? [{ id: g.id, name: g.name, provider: g.provider, memberId: no, status: 'Active' as const }] : [];
    });
    return [...own.map((b) => this.view(b)), ...gov];
  }

  async add(employeeId: string, input: BenefitInput, user: AuthUser) {
    const row = await this.prisma.$transaction(async (tx) => {
      const b = await tx.employeeBenefit.create({ data: { employeeId, name: input.name, provider: input.provider, memberId: seal(input.memberId) } });
      await this.audit.log({ actorId: user.userId, action: 'BENEFIT_ADDED', entity: 'Employee', entityId: employeeId, after: { name: input.name, provider: input.provider } }, tx);
      return b;
    });
    return this.view(row);
  }

  private async own(employeeId: string, id: string) {
    if (id.startsWith('gov-')) throw new BadRequestException('Government memberships come from your 201 record. Ask HR to change them.');
    const b = await this.prisma.employeeBenefit.findUnique({ where: { id } });
    if (!b || b.employeeId !== employeeId || b.removedAt) throw new NotFoundException('That benefit no longer exists');
    return b;
  }

  async confirm(employeeId: string, id: string, user: AuthUser) {
    const b = await this.own(employeeId, id);
    if (b.status === 'ACTIVE') return this.view(b);
    const row = await this.prisma.$transaction(async (tx) => {
      const next = await tx.employeeBenefit.update({ where: { id }, data: { status: 'ACTIVE', confirmedAt: new Date() } });
      await this.audit.log({ actorId: user.userId, action: 'BENEFIT_CONFIRMED', entity: 'Employee', entityId: employeeId, after: { name: b.name } }, tx);
      return next;
    });
    return this.view(row);
  }

  /** Removed benefits are kept (marked removed) for the audit trail. */
  async remove(employeeId: string, id: string, user: AuthUser) {
    const b = await this.own(employeeId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeBenefit.update({ where: { id }, data: { removedAt: new Date() } });
      await this.audit.log({ actorId: user.userId, action: 'BENEFIT_REMOVED', entity: 'Employee', entityId: employeeId, before: { name: b.name, provider: b.provider } }, tx);
    });
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Roles(...EVERYONE)
@Controller('me/benefits')
export class BenefitsController {
  constructor(private readonly benefits: BenefitsService) {}

  @Get()
  @ApiOperation({ operationId: 'listMyBenefits', summary: 'Your HMO and other benefits, and the government memberships on your record' })
  list(@CurrentUser() user: AuthUser) {
    return this.benefits.list(requireEmployeeId(user));
  }

  @Post()
  @ApiOperation({ operationId: 'addMyBenefit', summary: 'Add a benefit or dependent (pending until you confirm it)' })
  @ApiZodBody(BenefitInputSchema)
  add(@CurrentUser() user: AuthUser, @Body(new ZodPipe(BenefitInputSchema)) body: BenefitInput) {
    return this.benefits.add(requireEmployeeId(user), body, user);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @ApiOperation({ operationId: 'confirmMyBenefit', summary: 'Confirm a pending enrollment' })
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.benefits.confirm(requireEmployeeId(user), id, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'removeMyBenefit', summary: 'Remove a benefit you added' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.benefits.remove(requireEmployeeId(user), id, user);
  }
}

@Module({ imports: [EmployeesModule], controllers: [BenefitsController], providers: [BenefitsService] })
export class BenefitsModule {}
