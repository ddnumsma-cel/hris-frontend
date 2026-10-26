import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrgDepartment, OrgLocation, SaveDepartment, SaveLocation } from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { fullName } from './employees.service';

/** Office + department pair id, as the website keys a department at an office. */
const pairId = (siteId: string, departmentId: string) => `${siteId}:${departmentId}`;
function splitPair(id: string) {
  const [siteId, departmentId] = id.split(':');
  if (!siteId || !departmentId) throw new NotFoundException('That department no longer exists');
  return { siteId, departmentId };
}

/** Maintenance of offices (sites) and the departments at each office. Every change is audit-logged. */
@Injectable()
export class OrgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Offices ----------

  async locations(): Promise<OrgLocation[]> {
    const [sites, counts] = await Promise.all([
      this.prisma.site.findMany({
        include: { manager: true, _count: { select: { departments: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.employee.groupBy({ by: ['siteId'], where: { active: true }, _count: true }),
    ]);
    const headcount = new Map(counts.map((c) => [c.siteId, c._count]));
    return sites.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      address: s.address,
      contactName: s.contactName,
      contactPhone: s.contactPhone,
      manager: s.manager ? { id: s.manager.id, name: fullName(s.manager) } : null,
      active: s.active,
      headcount: headcount.get(s.id) ?? 0,
      departments: s._count.departments,
    }));
  }

  private async activeEmployee(id: string | null | undefined, what: string) {
    if (!id) return null;
    const e = await this.prisma.employee.findUnique({ where: { id }, select: { id: true, active: true } });
    if (!e || !e.active) throw new BadRequestException(`Choose a current employee as ${what}`);
    return e.id;
  }

  async saveLocation(id: string | null, input: SaveLocation, actorId: string): Promise<OrgLocation> {
    const existing = id ? await this.prisma.site.findUnique({ where: { id } }) : null;
    if (id && !existing) throw new NotFoundException('That office no longer exists');
    // The name is used across attendance, holidays and payroll, so it isn't renamed here (as on the website).
    if (existing && existing.name !== input.name)
      throw new BadRequestException(
        "An office's name can't be changed here: it is used across attendance, holidays and payroll. Change the code or address, or add a new office.",
      );
    const clash = await this.prisma.site.findFirst({
      where: {
        id: id ? { not: id } : undefined,
        OR: [{ name: { equals: input.name, mode: 'insensitive' } }, { code: input.code }],
      },
    });
    if (clash)
      throw new ConflictException(
        clash.code === input.code ? 'Another office already uses that code' : "There's already an office with that name",
      );
    const managerId = await this.activeEmployee(input.managerId, 'manager');
    const data = {
      name: input.name,
      code: input.code,
      address: input.address,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      managerId,
    };
    const site = await this.prisma.$transaction(async (tx) => {
      const s = existing
        ? await tx.site.update({ where: { id: existing.id }, data })
        : await tx.site.create({ data });
      await this.audit.log(
        {
          actorId,
          action: existing ? 'LOCATION_UPDATED' : 'LOCATION_CREATED',
          entity: 'Site',
          entityId: s.id,
          before: existing ?? undefined,
          after: data,
        },
        tx,
      );
      return s;
    });
    return (await this.locations()).find((l) => l.id === site.id)!;
  }

  async setLocationActive(id: string, active: boolean, actorId: string): Promise<void> {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('That office no longer exists');
    if (!active) {
      const people = await this.prisma.employee.count({ where: { siteId: id, active: true } });
      if (people > 0)
        throw new ConflictException(`${people} people still work in ${site.name}. Move them to another office first.`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.site.update({ where: { id }, data: { active } });
      await this.audit.log(
        { actorId, action: active ? 'LOCATION_REACTIVATED' : 'LOCATION_DEACTIVATED', entity: 'Site', entityId: id },
        tx,
      );
    });
  }

  // ---------- Departments at each office ----------

  async departments(): Promise<OrgDepartment[]> {
    const [rows, counts] = await Promise.all([
      this.prisma.siteDepartment.findMany({ include: { site: true, department: true, head: true } }),
      this.prisma.employee.groupBy({ by: ['siteId', 'departmentId'], where: { active: true }, _count: true }),
    ]);
    const headcount = new Map(counts.map((c) => [pairId(c.siteId, c.departmentId), c._count]));
    return rows
      .map((r) => ({
        id: pairId(r.siteId, r.departmentId),
        departmentId: r.departmentId,
        name: r.department.name,
        code: r.department.code,
        officeId: r.siteId,
        office: r.site.name,
        head: r.head ? { id: r.head.id, name: fullName(r.head) } : null,
        active: r.active,
        headcount: headcount.get(pairId(r.siteId, r.departmentId)) ?? 0,
      }))
      .sort((a, b) => a.office.localeCompare(b.office) || a.name.localeCompare(b.name));
  }

  /**
   * Add or edit a department at an office. Departments are shared across offices by name: adding "Tax" at Davao reuses
   * the company's Tax department if there is one (its code must match), otherwise creates it.
   */
  async saveDepartment(id: string | null, input: SaveDepartment, actorId: string): Promise<OrgDepartment> {
    const office = await this.prisma.site.findUnique({ where: { id: input.officeId } });
    if (!office || !office.active) throw new BadRequestException('Choose the office');
    const headEmployeeId = await this.activeEmployee(input.headEmployeeId, 'head');
    const existing = id ? splitPair(id) : null;
    if (existing && !(await this.prisma.siteDepartment.findUnique({ where: { siteId_departmentId: existing } })))
      throw new NotFoundException('That department no longer exists');

    const result = await this.prisma.$transaction(async (tx) => {
      let departmentId: string;
      if (existing) {
        // Editing: name and code belong to the company-wide department; the office stays (people are placed by it).
        if (existing.siteId !== office.id)
          throw new BadRequestException("A department can't move to another office here. Add it at the new office instead.");
        const clash = await tx.department.findFirst({
          where: {
            id: { not: existing.departmentId },
            OR: [{ code: input.code }, { name: { equals: input.name, mode: 'insensitive' } }],
          },
        });
        if (clash) throw new ConflictException('Another department already uses that name or code');
        await tx.department.update({ where: { id: existing.departmentId }, data: { name: input.name, code: input.code } });
        departmentId = existing.departmentId;
        await tx.siteDepartment.update({
          where: { siteId_departmentId: existing },
          data: { headEmployeeId },
        });
      } else {
        const byName = await tx.department.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' } } });
        if (byName && byName.code !== input.code)
          throw new ConflictException(`The ${byName.name} department uses the code ${byName.code}; use the same code`);
        if (!byName && (await tx.department.findUnique({ where: { code: input.code } })))
          throw new ConflictException('Another department already uses that code');
        const dept = byName ?? (await tx.department.create({ data: { name: input.name, code: input.code } }));
        departmentId = dept.id;
        if (await tx.siteDepartment.findUnique({ where: { siteId_departmentId: { siteId: office.id, departmentId } } }))
          throw new ConflictException(`${office.name} already has a department with that name`);
        await tx.siteDepartment.create({ data: { siteId: office.id, departmentId, headEmployeeId } });
      }
      await this.audit.log(
        {
          actorId,
          action: existing ? 'DEPARTMENT_UPDATED' : 'DEPARTMENT_CREATED',
          entity: 'SiteDepartment',
          entityId: pairId(office.id, departmentId),
          after: { ...input, headEmployeeId },
        },
        tx,
      );
      return pairId(office.id, departmentId);
    });
    return (await this.departments()).find((d) => d.id === result)!;
  }

  async setDepartmentActive(id: string, active: boolean, actorId: string): Promise<void> {
    const key = splitPair(id);
    const row = await this.prisma.siteDepartment.findUnique({
      where: { siteId_departmentId: key },
      include: { department: true },
    });
    if (!row) throw new NotFoundException('That department no longer exists');
    if (!active) {
      const people = await this.prisma.employee.count({ where: { ...key, active: true } });
      if (people > 0)
        throw new ConflictException(
          `${people} people are still in ${row.department.name}. Move them to another department first.`,
        );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.siteDepartment.update({ where: { siteId_departmentId: key }, data: { active } });
      await this.audit.log(
        {
          actorId,
          action: active ? 'DEPARTMENT_REACTIVATED' : 'DEPARTMENT_DEACTIVATED',
          entity: 'SiteDepartment',
          entityId: id,
        },
        tx,
      );
    });
  }
}
