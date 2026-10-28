import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CaseInput, CaseInputSchema, CaseUpdate, CaseUpdateSchema, ReviewStatusInput, ReviewStatusSchema } from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../common/zod';
import { EmployeesModule } from '../employees/employees.module';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../prisma/prisma.service';

const initials = (first: string, last: string) => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();

/**
 * The approver's people tools (Partner tools in the access table): employee relations cases and performance review
 * status for their team. An approver manages their own team; HR views everything; the Super Admin does everything.
 * Cases are sensitive (conduct, grievances): never shown to the employee concerned, never deleted (closed instead).
 */
@Injectable()
export class PartnerToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
  ) {}

  /** Who this person may see: an approver their team, HR and the Super Admin everyone. */
  private async scope(user: AuthUser): Promise<string[] | undefined> {
    if (user.role === 'HR_ADMIN' || user.role === 'SYSTEM_ADMIN') return undefined;
    if (user.role === 'MANAGER' && user.employeeId) return this.employees.teamIds(user.employeeId);
    return [];
  }

  /** May change things for this employee: their approver, or the Super Admin. HR only looks. */
  private async assertManages(user: AuthUser, employeeId: string) {
    if (user.role === 'SYSTEM_ADMIN') return;
    if (user.role === 'MANAGER' && user.employeeId && (await this.employees.teamIds(user.employeeId)).includes(employeeId)) return;
    throw new ForbiddenException('Only their approver or the Super Admin can change this');
  }

  private async byNo(employeeNo: string) {
    const e = await this.prisma.employee.findUnique({ where: { employeeNo } });
    if (!e) throw new NotFoundException('That employee no longer exists');
    return e;
  }

  // ---------- Cases ----------

  private caseView(c: { id: string; type: string; status: string; summary: string; filedBy: string; filedAt: Date; employee: { employeeNo: string; firstName: string; lastName: string } }) {
    return { id: c.id, employeeId: c.employee.employeeNo, employeeName: `${c.employee.firstName} ${c.employee.lastName}`, employeeInitials: initials(c.employee.firstName, c.employee.lastName), type: c.type, status: c.status, filedBy: c.filedBy, filedOn: c.filedAt.toISOString().slice(0, 10), summary: c.summary };
  }

  async cases(user: AuthUser) {
    const ids = await this.scope(user);
    const rows = await this.prisma.employeeCase.findMany({ where: { closedAt: null, ...(ids ? { employeeId: { in: ids } } : {}) }, include: { employee: { select: { employeeNo: true, firstName: true, lastName: true } } }, orderBy: { filedAt: 'desc' } });
    return rows.map((c) => this.caseView(c));
  }

  async fileCase(input: CaseInput, user: AuthUser) {
    const e = await this.byNo(input.employeeNo);
    await this.assertManages(user, e.id);
    const c = await this.prisma.$transaction(async (tx) => {
      const row = await tx.employeeCase.create({ data: { employeeId: e.id, type: input.type, summary: input.summary, filedBy: user.displayName, filedById: user.userId }, include: { employee: { select: { employeeNo: true, firstName: true, lastName: true } } } });
      // The audit row names the case type, not its details (the summary can be sensitive).
      await this.audit.log({ actorId: user.userId, action: 'CASE_FILED', entity: 'EmployeeCase', entityId: row.id, after: { employeeNo: e.employeeNo, type: input.type } }, tx);
      return row;
    });
    return this.caseView(c);
  }

  async updateCase(id: string, input: CaseUpdate, user: AuthUser) {
    const c = await this.prisma.employeeCase.findUnique({ where: { id } });
    if (!c || c.closedAt) throw new NotFoundException('That case no longer exists');
    await this.assertManages(user, c.employeeId);
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.employeeCase.update({ where: { id }, data: { ...(input.type ? { type: input.type } : {}), ...(input.summary ? { summary: input.summary } : {}), ...(input.status ? { status: input.status } : {}) }, include: { employee: { select: { employeeNo: true, firstName: true, lastName: true } } } });
      await this.audit.log({ actorId: user.userId, action: 'CASE_UPDATED', entity: 'EmployeeCase', entityId: id, before: { type: c.type, status: c.status }, after: { type: r.type, status: r.status, summaryChanged: !!input.summary && input.summary !== c.summary } }, tx);
      return r;
    });
    return this.caseView(row);
  }

  /** Taken off the list (kept for the record, with who and when). */
  async closeCase(id: string, user: AuthUser) {
    const c = await this.prisma.employeeCase.findUnique({ where: { id } });
    if (!c || c.closedAt) throw new NotFoundException('That case no longer exists');
    await this.assertManages(user, c.employeeId);
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeCase.update({ where: { id }, data: { closedAt: new Date(), closedBy: user.displayName } });
      await this.audit.log({ actorId: user.userId, action: 'CASE_REMOVED', entity: 'EmployeeCase', entityId: id, before: { type: c.type, status: c.status } }, tx);
    });
  }

  // ---------- Performance reviews ----------

  async reviews(user: AuthUser, year: number) {
    const ids = await this.scope(user);
    const rows = await this.prisma.performanceReview.findMany({ where: { year, ...(ids ? { employeeId: { in: ids } } : {}) }, include: { employee: { select: { employeeNo: true } } } });
    return Object.fromEntries(rows.map((r) => [r.employee.employeeNo, r.status as 'Submitted' | 'Pending']));
  }

  async setReview(employeeNo: string, input: ReviewStatusInput, user: AuthUser) {
    const e = await this.byNo(employeeNo);
    await this.assertManages(user, e.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceReview.upsert({ where: { employeeId_year: { employeeId: e.id, year: input.year } }, create: { employeeId: e.id, year: input.year, status: input.status, updatedBy: user.displayName }, update: { status: input.status, updatedBy: user.displayName } });
      await this.audit.log({ actorId: user.userId, action: 'PERFORMANCE_REVIEW_STATUS', entity: 'Employee', entityId: e.id, after: { year: input.year, status: input.status } }, tx);
    });
    return { employeeId: employeeNo, status: input.status };
  }
}

@ApiTags('partner tools')
@ApiBearerAuth()
@Roles('MANAGER', 'HR_ADMIN', 'SYSTEM_ADMIN')
@Controller()
export class PartnerToolsController {
  constructor(private readonly tools: PartnerToolsService) {}

  @Get('cases')
  @ApiOperation({ operationId: 'listCases', summary: "Employee relations cases: an approver's team, or everyone for HR and the Super Admin" })
  cases(@CurrentUser() user: AuthUser) {
    return this.tools.cases(user);
  }

  @Post('cases')
  @Roles('MANAGER', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'fileCase', summary: 'File a case about someone on your team' })
  @ApiZodBody(CaseInputSchema)
  fileCase(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CaseInputSchema)) body: CaseInput) {
    return this.tools.fileCase(body, user);
  }

  @Put('cases/:id')
  @Roles('MANAGER', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'updateCase', summary: "Change a case's type, summary or status" })
  @ApiZodBody(CaseUpdateSchema)
  updateCase(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(CaseUpdateSchema)) body: CaseUpdate) {
    return this.tools.updateCase(id, body, user);
  }

  @Delete('cases/:id')
  @HttpCode(204)
  @Roles('MANAGER', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'removeCase', summary: 'Take a case off the list (kept for the record)' })
  async closeCase(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.tools.closeCase(id, user);
  }

  @Get('performance/reviews')
  @ApiOperation({ operationId: 'reviewStatuses', summary: "Performance review status per person for a year (an approver's team, or everyone)" })
  reviews(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    const y = Number(year) || new Date().getFullYear();
    return this.tools.reviews(user, y);
  }

  @Put('performance/reviews/:employeeNo')
  @Roles('MANAGER', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'setReviewStatus', summary: "Mark someone's performance review submitted or pending" })
  @ApiZodBody(ReviewStatusSchema)
  setReview(@CurrentUser() user: AuthUser, @Param('employeeNo') employeeNo: string, @Body(new ZodPipe(ReviewStatusSchema)) body: ReviewStatusInput) {
    return this.tools.setReview(employeeNo, body, user);
  }
}

@Module({ imports: [EmployeesModule], controllers: [PartnerToolsController], providers: [PartnerToolsService] })
export class PartnerToolsModule {}
