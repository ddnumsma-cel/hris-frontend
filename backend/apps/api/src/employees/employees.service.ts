import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, seal, sealGovIds, unseal, unsealGovIds } from '@msma/db';
import {
  ChecklistEmployee,
  CreatedEmployee,
  CreateEmployee,
  dateKeyToUtcDate,
  EMPLOYMENT_STATUSES,
  money,
  roundMoney,
  EmployeeListItem,
  EmployeeListQuery,
  EmploymentEvent,
  manilaToday,
  moneyString,
  OrgFilters,
  PersonalInfo,
  RecordSeparation,
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
  /** Monthly salary (payroll pays half each cut-off); from the daily rate when not set. */
  monthlySalary: string;
  hireDate: string;
  separationDate: string | null;
  shift: ShiftDefinition & { id: string; code: string; name: string };
}

export const fullName = (e: { firstName: string; lastName: string }) =>
  `${e.firstName} ${e.lastName}`;

/** Plain digits in the groups a government number is written in ("3417654321", [2,7,1] → "34-1765432-1"); anything else as typed. */
function dashGov(value: string | undefined, groups: number[]): string {
  const v = (value ?? '').trim();
  const digits = v.replace(/\D/g, '');
  if (!digits || digits.length !== v.replace(/[\s-]/g, '').length) return v;
  const parts: string[] = [];
  let at = 0;
  for (const n of groups) {
    if (at >= digits.length) break;
    parts.push(digits.slice(at, at + n));
    at += n;
  }
  if (at < digits.length) parts[parts.length - 1] += digits.slice(at);
  return parts.join('-');
}

/** Employee master data (the 201 file). Other modules use this service instead of the Employee table. */
const NUMBER_FIELDS = new Set(['tin', 'sss', 'philhealth', 'pagibig', 'bankAccountNo', 'accountNo', 'accountNumber']);
/** A copy with government and bank numbers cut to their last four digits (for the audit trail). */
const hideNumbers = <T>(o: T): T =>
  JSON.parse(JSON.stringify(o ?? null), (k, v) => (NUMBER_FIELDS.has(k) && typeof v === 'string' && v ? `••••${v.replace(/\D/g, '').slice(-4)}` : v));

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
      middleName: e.middleName,
      lastName: e.lastName,
      fullName: fullName(e),
      email: e.email,
      status: e.status,
      hireDate: utcDateToDateKey(e.hireDate),
      site: { id: e.site.id, name: e.site.name },
      department: { id: e.department.id, name: e.department.name },
      position: e.position?.title ?? null,
      dailyRate: moneyString(e.dailyRate.toString()),
      todayStatus: null,
      managerId: e.managerId,
      shiftId: e.shiftId,
      separationDate: e.separationDate ? utcDateToDateKey(e.separationDate) : null,
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
        ? unsealGovIds({
            tin: e.govId.tin,
            sss: e.govId.sss,
            philhealth: e.govId.philhealth,
            pagibig: e.govId.pagibig,
          })
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
      suffix: e.suffix,
      sex: e.sex,
      nationality: e.nationality,
      civilStatus: e.civilStatus,
      address: e.address,
      city: e.city,
      province: e.province,
      bank:
        e.bankName && e.bankAccountName && e.bankAccountNo
          ? { bankName: e.bankName, accountName: e.bankAccountName, accountNo: unseal(e.bankAccountNo) }
          : null,
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
    const storedIds = await this.prisma.govId.findUnique({ where: { employeeId: id } });
    const beforeIds = storedIds ? unsealGovIds(storedIds) : null;
    if (patch.workEmail) {
      const clash = await this.prisma.employee.findFirst({
        where: { id: { not: id }, email: { equals: patch.workEmail, mode: 'insensitive' } },
        select: { employeeNo: true },
      });
      if (clash) throw new ConflictException(`This work email is already on ${clash.employeeNo}'s record`);
    }
    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.EmployeeUpdateInput = {};
      if (patch.firstName !== undefined) data.firstName = patch.firstName;
      if (patch.middleName !== undefined) data.middleName = patch.middleName;
      if (patch.lastName !== undefined) data.lastName = patch.lastName;
      if (patch.suffix !== undefined) data.suffix = patch.suffix;
      if (patch.birthDate !== undefined)
        data.birthDate = patch.birthDate ? dateKeyToUtcDate(patch.birthDate) : null;
      if (patch.sex !== undefined) data.sex = patch.sex;
      if (patch.nationality !== undefined) data.nationality = patch.nationality;
      if (patch.workEmail !== undefined) data.email = patch.workEmail;
      if (patch.city !== undefined) data.city = patch.city;
      if (patch.province !== undefined) data.province = patch.province;
      if (patch.bank !== undefined) {
        data.bankName = patch.bank?.bankName ?? null;
        data.bankAccountName = patch.bank?.accountName ?? null;
        data.bankAccountNo = seal(patch.bank?.accountNo ?? null);
      }
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
          create: { employeeId: id, ...sealGovIds(patch.govIds) },
          update: sealGovIds(patch.govIds),
        });
      await this.audit.log(
        {
          actorId,
          action: 'PERSONAL_INFO_UPDATED',
          entity: 'Employee',
          entityId: id,
          // Government and bank numbers stay out of the audit trail in full: only the last four digits are kept.
          before: hideNumbers({ ...before, govIds: patch.govIds ? beforeIds : undefined }),
          after: hideNumbers({ ...patch, effectiveDate: patch.effectiveDate ?? manilaToday() }),
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
   * HR marks someone Separated: saves their last day and adds a SEPARATED history entry (the mark that takes them off
   * the attendance terminals once the last day has passed).
   */
  async recordSeparation(id: string, input: RecordSeparation, actorId: string): Promise<void> {
    const e = await this.prisma.employee.findUnique({ where: { id }, select: { hireDate: true, separationDate: true } });
    if (!e) throw new NotFoundException('That employee no longer exists');
    if (e.separationDate) throw new ConflictException('This employee is already marked separated. Cancel that first to change it.');
    if (input.lastDay < utcDateToDateKey(e.hireDate)) throw new BadRequestException("The last day can't be before they were hired");
    const lastDay = dateKeyToUtcDate(input.lastDay);
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: { separationDate: lastDay } });
      await tx.employmentEvent.create({
        data: { employeeId: id, type: 'SEPARATED', effectiveDate: lastDay, remarks: input.note ? `${input.reason}: ${input.note}` : input.reason },
      });
      await this.audit.log(
        { actorId, action: 'EMPLOYEE_SEPARATED', entity: 'Employee', entityId: id, after: { lastDay: input.lastDay, reason: input.reason, note: input.note } },
        tx,
      );
    });
  }

  /** Undo a separation recorded by mistake or a withdrawn resignation: the mark and last day are removed. */
  async cancelSeparation(id: string, actorId: string): Promise<void> {
    const e = await this.prisma.employee.findUnique({ where: { id }, select: { separationDate: true } });
    if (!e) throw new NotFoundException('That employee no longer exists');
    if (!e.separationDate) throw new ConflictException("There's no separation to cancel");
    const lastDay = utcDateToDateKey(e.separationDate);
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: { separationDate: null } });
      await tx.employmentEvent.deleteMany({ where: { employeeId: id, type: 'SEPARATED' } });
      await this.audit.log(
        { actorId, action: 'EMPLOYEE_SEPARATION_CANCELLED', entity: 'Employee', entityId: id, before: { lastDay } },
        tx,
      );
    });
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
    const [sites, departments, positions, shifts, onShift] = await Promise.all([
      this.prisma.site.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.department.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.position.findMany({ orderBy: { title: 'asc' } }),
      this.prisma.shift.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
      this.prisma.employee.groupBy({ by: ['shiftId'], where: { active: true }, _count: true }),
    ]);
    const people = new Map(onShift.map((c) => [c.shiftId, c._count]));
    // HQ first, then branches
    const siteOrder = ['HQ', 'MND', 'LLC'];
    sites.sort((a, b) => siteOrder.indexOf(a.code) - siteOrder.indexOf(b.code));
    return {
      sites: sites.map((s) => ({ id: s.id, name: s.name })),
      departments: departments.map((d) => ({ id: d.id, name: d.name })),
      statuses: [...EMPLOYMENT_STATUSES],
      positions: positions.map((p) => ({ id: p.id, name: p.title, departmentId: p.departmentId })),
      shifts: shifts.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        breakMinutes: s.breakMinutes,
        graceMinutes: s.graceMinutes,
        workDays: s.workDays,
        breakStart: s.breakStart,
        flexible: s.flexible,
        requiredMinutes: s.requiredMinutes,
        saturdayEnd: s.saturdayEnd,
        active: s.active,
        people: people.get(s.id) ?? 0,
      })),
    };
  }

  /** Add a new hire: the record, their government numbers, a HIRED history entry and an audit row, in one go. */
  async create(input: CreateEmployee, actorId: string | null): Promise<CreatedEmployee> {
    const [site, department, position, manager, shift] = await Promise.all([
      this.prisma.site.findUnique({ where: { id: input.siteId } }),
      this.prisma.department.findUnique({ where: { id: input.departmentId } }),
      input.positionId ? this.prisma.position.findUnique({ where: { id: input.positionId } }) : null,
      input.managerId ? this.prisma.employee.findUnique({ where: { id: input.managerId } }) : null,
      input.shiftId
        ? this.prisma.shift.findUnique({ where: { id: input.shiftId } })
        : this.prisma.shift
            .findUnique({ where: { code: 'DAY' } })
            .then((s) => s ?? this.prisma.shift.findFirst({ orderBy: { startTime: 'asc' } })),
    ]);
    if (!site) throw new BadRequestException('That office no longer exists');
    if (!department) throw new BadRequestException('That department no longer exists');
    if (input.positionId && (!position || position.departmentId !== department.id))
      throw new BadRequestException('Pick a position from the chosen department');
    if (input.managerId && (!manager || !manager.active))
      throw new BadRequestException('Pick an active employee as the supervisor');
    if (!shift) throw new BadRequestException(input.shiftId ? 'That shift no longer exists' : 'Add a shift first');

    // The same person twice is usually a typo or a re-hire: point HR at the existing record.
    const contact: Prisma.EmployeeWhereInput[] = [{ email: { equals: input.workEmail, mode: 'insensitive' } }];
    if (input.mobileNo) contact.push({ mobileNo: input.mobileNo });
    const clash = await this.prisma.employee.findFirst({ where: { OR: contact }, select: { employeeNo: true, email: true } });
    if (clash) {
      const what = clash.email?.toLowerCase() === input.workEmail ? 'work email' : 'mobile number';
      throw new ConflictException(`This ${what} is already on ${clash.employeeNo}'s record`);
    }

    // Government numbers: dashes added to plain digits (3417654321 → 34-1765432-1); missing ones stay blank.
    const govIds = input.govIds && Object.values(input.govIds).some(Boolean)
      ? {
          tin: dashGov(input.govIds.tin, [3, 3, 3, 3]),
          sss: dashGov(input.govIds.sss, [2, 7, 1]),
          philhealth: dashGov(input.govIds.philhealth, [2, 9, 1]),
          pagibig: dashGov(input.govIds.pagibig, [4, 4, 4]),
        }
      : null;

    // Daily rate from the monthly salary: monthly × 12 ÷ 261 working days.
    const dailyRate = roundMoney(money(input.monthlySalary).mul(12).div(261));

    return this.prisma.$transaction(async (tx) => {
      const numbers = await tx.employee.findMany({ where: { employeeNo: { startsWith: 'MSMA-' } }, select: { employeeNo: true } });
      const next = Math.max(0, ...numbers.map((n) => Number(n.employeeNo.slice(5)) || 0)) + 1;
      const employeeNo = `MSMA-${String(next).padStart(4, '0')}`;
      const pins = await tx.employee.findMany({ select: { biometricPin: true } });
      const biometricPin = String(Math.max(1000, ...pins.map((p) => Number(p.biometricPin) || 0)) + 1);

      const e = await tx.employee.create({
        data: {
          employeeNo,
          biometricPin,
          firstName: input.firstName,
          middleName: input.middleName ?? null,
          lastName: input.lastName,
          suffix: input.suffix ?? null,
          birthDate: dateKeyToUtcDate(input.birthDate),
          sex: input.sex,
          civilStatus: input.civilStatus,
          nationality: input.nationality ?? null,
          email: input.workEmail,
          personalEmail: input.personalEmail ?? null,
          mobileNo: input.mobileNo,
          address: input.address ?? null,
          city: input.city ?? null,
          province: input.province ?? null,
          emergencyName: input.emergencyContact?.name ?? null,
          emergencyRelationship: input.emergencyContact?.relationship ?? null,
          emergencyPhone: input.emergencyContact?.phone ?? null,
          cluster: input.cluster ?? null,
          status: input.status,
          hireDate: dateKeyToUtcDate(input.hireDate),
          dailyRate: dailyRate.toFixed(2),
          monthlySalary: money(input.monthlySalary).toFixed(2),
          siteId: site.id,
          departmentId: department.id,
          positionId: position?.id ?? null,
          managerId: manager?.id ?? null,
          shiftId: shift.id,
          ...(govIds ? { govId: { create: sealGovIds(govIds) } } : {}),
        },
      });
      await tx.employmentEvent.create({
        data: {
          employeeId: e.id,
          type: 'HIRED',
          effectiveDate: dateKeyToUtcDate(input.hireDate),
          positionTitle: position?.title ?? null,
          siteName: site.name,
          dailyRate: dailyRate.toFixed(2),
          remarks: `Hired as ${input.status.toLowerCase()}`,
        },
      });
      await this.audit.log(
        {
          actorId,
          action: 'EMPLOYEE_CREATED',
          entity: 'Employee',
          entityId: e.id,
          after: { employeeNo, name: fullName(e), siteId: site.id, departmentId: department.id, status: input.status, hireDate: input.hireDate },
        },
        tx,
      );
      return { id: e.id, employeeNo, fullName: fullName(e) };
    });
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

  /**
   * Active employees' device IDs (biometric PINs) and names, for keeping the terminals' user lists in step.
   * Someone HR has marked Separated is left out once their last day has passed.
   */
  async devicePins(): Promise<{ id: string; pin: string; name: string }[]> {
    const today = dateKeyToUtcDate(manilaToday());
    const rows = await this.prisma.employee.findMany({
      where: { active: true, events: { none: { type: 'SEPARATED', effectiveDate: { lt: today } } } },
      select: { id: true, biometricPin: true, firstName: true, lastName: true },
      orderBy: { biometricPin: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, pin: r.biometricPin, name: fullName(r) }));
  }

  /**
   * Device IDs of employees HR has marked Separated (a SEPARATED history entry) whose last day has passed: they come
   * off the terminals. Nothing else (an inactive record, a separation date alone) takes anyone off.
   */
  async separatedPins(): Promise<Set<string>> {
    const today = dateKeyToUtcDate(manilaToday());
    const rows = await this.prisma.employee.findMany({
      where: { events: { some: { type: 'SEPARATED', effectiveDate: { lt: today } } } },
      select: { biometricPin: true },
    });
    return new Set(rows.map((r) => r.biometricPin));
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
      monthlySalary: (e.monthlySalary ?? roundMoney(money(e.dailyRate.toString()).times(261).dividedBy(12))).toString(),
      hireDate: utcDateToDateKey(e.hireDate),
      separationDate: e.separationDate ? utcDateToDateKey(e.separationDate) : null,
      shift: {
        id: e.shift.id,
        code: e.shift.code,
        name: e.shift.name,
        startTime: e.shift.startTime,
        endTime: e.shift.endTime,
        breakMinutes: e.shift.breakMinutes,
        graceMinutes: e.shift.graceMinutes,
        workDays: e.shift.workDays,
        breakStart: e.shift.breakStart,
        flexible: e.shift.flexible,
        requiredMinutes: e.shift.requiredMinutes,
      },
    }));
  }

  async forComputeOne(id: string): Promise<EmployeeForCompute> {
    const [e] = await this.forCompute({ ids: [id] });
    if (!e) throw new NotFoundException('Employee not found');
    return e;
  }
}
