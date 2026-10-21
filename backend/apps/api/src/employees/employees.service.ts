import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import {
  ChecklistEmployee,
  dateKeyToUtcDate,
  EMPLOYMENT_STATUSES,
  EmployeeListItem,
  EmployeeListQuery,
  EmploymentEvent,
  manilaToday,
  moneyString,
  OrgFilters,
  PersonalInfo,
  ShiftDefinition,
  UpdatePersonalInfo,
  utcDateToDateKey,
} from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const listInclude = {
  site: true,
  department: true,
  position: true,
} satisfies Prisma.EmployeeInclude;
type EmployeeWithOrg = Prisma.EmployeeGetPayload<{ include: typeof listInclude }>;

export interface EmployeeForCompute {
  id: string;
  employeeNo: string;
  fullName: string;
  siteId: string;
  siteName: string;
  dailyRate: string;
  hireDate: string;
  shift: ShiftDefinition & { name: string };
}

export const fullName = (e: { firstName: string; lastName: string }) =>
  `${e.firstName} ${e.lastName}`;

/** Employee master data (the 201 file). Other modules use this service instead of the Employee table. */
@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  toListItem(e: EmployeeWithOrg): EmployeeListItem {
    return {
      id: e.id,
      employeeNo: e.employeeNo,
      firstName: e.firstName,
      lastName: e.lastName,
      fullName: fullName(e),
      status: e.status,
      hireDate: utcDateToDateKey(e.hireDate),
      site: { id: e.site.id, name: e.site.name },
      department: { id: e.department.id, name: e.department.name },
      position: e.position?.title ?? null,
      dailyRate: moneyString(e.dailyRate.toString()),
      todayStatus: null,
      record201: null,
    };
  }

  async list(query: EmployeeListQuery, scopeIds?: string[]) {
    const words = query.q?.split(/\s+/).filter(Boolean) ?? [];
    const where: Prisma.EmployeeWhereInput = {
      active: true,
      ...(scopeIds ? { id: { in: scopeIds } } : {}),
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      AND: words.map((w) => ({
        OR: [
          { firstName: { contains: w, mode: 'insensitive' as const } },
          { lastName: { contains: w, mode: 'insensitive' as const } },
          { employeeNo: { contains: w, mode: 'insensitive' as const } },
        ],
      })),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        include: listInclude,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((r) => this.toListItem(r)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async profile(id: string) {
    const e = await this.prisma.employee.findUnique({
      where: { id },
      include: { ...listInclude, govId: true, manager: true, shift: true },
    });
    if (!e) throw new NotFoundException('Employee not found');
    return {
      ...this.toListItem(e),
      middleName: e.middleName,
      email: e.email,
      mobileNo: e.mobileNo,
      birthDate: e.birthDate ? utcDateToDateKey(e.birthDate) : null,
      manager: e.manager ? { id: e.manager.id, fullName: fullName(e.manager) } : null,
      shift: { name: e.shift.name, startTime: e.shift.startTime, endTime: e.shift.endTime },
      govIds: e.govId
        ? {
            tin: e.govId.tin,
            sss: e.govId.sss,
            philhealth: e.govId.philhealth,
            pagibig: e.govId.pagibig,
          }
        : null,
    };
  }

  /** Personal data sheet, dependents and separation details. */
  async personal(id: string): Promise<PersonalInfo> {
    const e = await this.prisma.employee.findUnique({
      where: { id },
      include: { dependents: { orderBy: { birthDate: 'asc' } } },
    });
    if (!e) throw new NotFoundException('Employee not found');
    return {
      civilStatus: e.civilStatus,
      address: e.address,
      mobileNo: e.mobileNo,
      personalEmail: e.personalEmail,
      emergencyContact:
        e.emergencyName && e.emergencyPhone
          ? {
              name: e.emergencyName,
              relationship: e.emergencyRelationship ?? '',
              phone: e.emergencyPhone,
            }
          : null,
      licenseType: e.licenseType,
      regularizationDate: e.regularizationDate ? utcDateToDateKey(e.regularizationDate) : null,
      separationDate: e.separationDate ? utcDateToDateKey(e.separationDate) : null,
      separationReason: e.separationReason,
      dependents: e.dependents.map((d) => ({
        name: d.name,
        relationship: d.relationship,
        birthDate: d.birthDate ? utcDateToDateKey(d.birthDate) : null,
      })),
    };
  }

  /** Effective-dated employment history, newest first. Pay is hidden unless `showPay`. */
  async history(id: string, showPay: boolean): Promise<EmploymentEvent[]> {
    const rows = await this.prisma.employmentEvent.findMany({
      where: { employeeId: id },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      effectiveDate: utcDateToDateKey(r.effectiveDate),
      positionTitle: r.positionTitle,
      siteName: r.siteName,
      dailyRate: showPay && r.dailyRate ? moneyString(r.dailyRate.toString()) : null,
      remarks: r.remarks,
    }));
  }

  /**
   * Update the personal data sheet / government numbers. Every change is audit-logged with
   * the before/after values and the date it takes effect.
   */
  async updatePersonal(
    id: string,
    patch: UpdatePersonalInfo,
    actorId: string,
  ): Promise<PersonalInfo> {
    const before = await this.personal(id);
    const beforeIds = await this.prisma.govId.findUnique({ where: { employeeId: id } });
    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.EmployeeUpdateInput = {};
      if (patch.civilStatus !== undefined) data.civilStatus = patch.civilStatus;
      if (patch.address !== undefined) data.address = patch.address;
      if (patch.mobileNo !== undefined) data.mobileNo = patch.mobileNo;
      if (patch.personalEmail !== undefined) data.personalEmail = patch.personalEmail;
      if (patch.licenseType !== undefined) data.licenseType = patch.licenseType;
      if (patch.regularizationDate !== undefined)
        data.regularizationDate = patch.regularizationDate
          ? dateKeyToUtcDate(patch.regularizationDate)
          : null;
      if (patch.emergencyContact !== undefined) {
        data.emergencyName = patch.emergencyContact?.name ?? null;
        data.emergencyRelationship = patch.emergencyContact?.relationship ?? null;
        data.emergencyPhone = patch.emergencyContact?.phone ?? null;
      }
      await tx.employee.update({ where: { id }, data });
      if (patch.dependents) {
        await tx.dependent.deleteMany({ where: { employeeId: id } });
        await tx.dependent.createMany({
          data: patch.dependents.map((d) => ({
            employeeId: id,
            name: d.name,
            relationship: d.relationship,
            birthDate: d.birthDate ? dateKeyToUtcDate(d.birthDate) : null,
          })),
        });
      }
      if (patch.govIds)
        await tx.govId.upsert({
          where: { employeeId: id },
          create: { employeeId: id, ...patch.govIds },
          update: patch.govIds,
        });
      await this.audit.log(
        {
          actorId,
          action: 'PERSONAL_INFO_UPDATED',
          entity: 'Employee',
          entityId: id,
          before: { ...before, govIds: patch.govIds ? beforeIds : undefined },
          after: { ...patch, effectiveDate: patch.effectiveDate ?? manilaToday() },
        },
        tx,
      );
    });
    return this.personal(id);
  }

  async biometricEnrolledAt(id: string): Promise<Date | null> {
    const e = await this.prisma.employee.findUnique({
      where: { id },
      select: { biometricEnrolledAt: true },
    });
    if (!e) throw new NotFoundException('Employee not found');
    return e.biometricEnrolledAt;
  }

  /** Record biometric enrollment. The caller must have checked the consent first. */
  async markBiometricEnrolled(id: string, actorId: string): Promise<Date> {
    const enrolledAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: { biometricEnrolledAt: enrolledAt } });
      await this.audit.log(
        {
          actorId,
          action: 'BIOMETRIC_ENROLLED',
          entity: 'Employee',
          entityId: id,
          after: { enrolledAt },
        },
        tx,
      );
    });
    return enrolledAt;
  }

  /**
   * What the 201 checklist needs to know about each employee (civil status, children, license,
   * separation, personal data sheet), plus names for lists. Active employees only.
   */
  async checklistFacts(filter: { ids?: string[]; siteId?: string; q?: string } = {}) {
    const words = filter.q?.split(/\s+/).filter(Boolean) ?? [];
    const rows = await this.prisma.employee.findMany({
      where: {
        active: true,
        ...(filter.ids ? { id: { in: filter.ids } } : {}),
        ...(filter.siteId ? { siteId: filter.siteId } : {}),
        AND: words.map((w) => ({
          OR: [
            { firstName: { contains: w, mode: 'insensitive' as const } },
            { lastName: { contains: w, mode: 'insensitive' as const } },
            { employeeNo: { contains: w, mode: 'insensitive' as const } },
          ],
        })),
      },
      include: {
        site: { select: { name: true } },
        position: { select: { title: true } },
        _count: { select: { dependents: { where: { relationship: 'CHILD' } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return rows.map((e) => ({
      id: e.id,
      employeeNo: e.employeeNo,
      fullName: fullName(e),
      siteName: e.site.name,
      position: e.position?.title ?? null,
      managerId: e.managerId,
      biometricEnrolledAt: e.biometricEnrolledAt,
      facts: {
        civilStatus: e.civilStatus,
        childrenCount: e._count.dependents,
        licenseType: e.licenseType,
        hireDate: utcDateToDateKey(e.hireDate),
        separationDate: e.separationDate ? utcDateToDateKey(e.separationDate) : null,
        personalDataComplete: !!(e.address && e.emergencyName && e.emergencyPhone),
      } satisfies ChecklistEmployee,
    }));
  }

  async managerIdOf(id: string): Promise<string | null> {
    const e = await this.prisma.employee.findUnique({ where: { id }, select: { managerId: true } });
    if (!e) throw new NotFoundException('Employee not found');
    return e.managerId;
  }

  async filters(): Promise<OrgFilters> {
    const [sites, departments] = await Promise.all([
      this.prisma.site.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.department.findMany({ orderBy: { name: 'asc' } }),
    ]);
    // HQ first, then branches
    const siteOrder = ['HQ', 'MND', 'LLC'];
    sites.sort((a, b) => siteOrder.indexOf(a.code) - siteOrder.indexOf(b.code));
    return {
      sites: sites.map((s) => ({ id: s.id, name: s.name })),
      departments: departments.map((d) => ({ id: d.id, name: d.name })),
      statuses: [...EMPLOYMENT_STATUSES],
    };
  }

  async sites() {
    return (await this.filters()).sites;
  }

  /** Direct reports of a manager (managers see only their team). */
  async teamIds(managerEmployeeId: string): Promise<string[]> {
    const rows = await this.prisma.employee.findMany({
      where: { managerId: managerEmployeeId, active: true },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async siteIdOf(employeeId: string): Promise<string | null> {
    return (
      (
        await this.prisma.employee.findUnique({
          where: { id: employeeId },
          select: { siteId: true },
        })
      )?.siteId ?? null
    );
  }

  /** employeeId → { name, siteId, siteName } for active employees (optionally one site). */
  async directory(
    siteId?: string,
  ): Promise<Map<string, { name: string; siteId: string; siteName: string }>> {
    const rows = await this.prisma.employee.findMany({
      where: { active: true, ...(siteId ? { siteId } : {}) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        siteId: true,
        site: { select: { name: true } },
      },
    });
    return new Map(
      rows.map((r) => [r.id, { name: fullName(r), siteId: r.siteId, siteName: r.site.name }]),
    );
  }

  async count(siteId?: string): Promise<number> {
    return this.prisma.employee.count({ where: { active: true, ...(siteId ? { siteId } : {}) } });
  }

  /** Map biometric PINs to employee ids (unknown PINs are omitted). */
  async resolvePins(pins: string[]): Promise<Map<string, string>> {
    const rows = await this.prisma.employee.findMany({
      where: { biometricPin: { in: pins } },
      select: { id: true, biometricPin: true },
    });
    return new Map(rows.map((r) => [r.biometricPin, r.id]));
  }

  /** Active employees with the data needed for DTR and payroll calculations. */
  async forCompute(
    filter: { siteId?: string; ids?: string[] } = {},
  ): Promise<EmployeeForCompute[]> {
    const rows = await this.prisma.employee.findMany({
      where: {
        active: true,
        ...(filter.siteId ? { siteId: filter.siteId } : {}),
        ...(filter.ids ? { id: { in: filter.ids } } : {}),
      },
      include: { site: true, shift: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return rows.map((e) => ({
      id: e.id,
      employeeNo: e.employeeNo,
      fullName: fullName(e),
      siteId: e.siteId,
      siteName: e.site.name,
      dailyRate: e.dailyRate.toString(),
      hireDate: utcDateToDateKey(e.hireDate),
      shift: {
        name: e.shift.name,
        startTime: e.shift.startTime,
        endTime: e.shift.endTime,
        breakMinutes: e.shift.breakMinutes,
        graceMinutes: e.shift.graceMinutes,
        workDays: e.shift.workDays,
      },
    }));
  }

  async forComputeOne(id: string): Promise<EmployeeForCompute> {
    const [e] = await this.forCompute({ ids: [id] });
    if (!e) throw new NotFoundException('Employee not found');
    return e;
  }
}
