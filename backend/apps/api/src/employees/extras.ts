import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CpdUnitsInput, CpdUnitsSchema, PhotoInput, PhotoInputSchema, utcDateToDateKey } from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, requireEmployeeId, Roles } from '../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from './employees.service';

const EVERYONE = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN'] as const;

/** CPD units a cycle needs (the website's figure for CPAs). */
export const CPD_UNITS_REQUIRED = 60;

/**
 * The parts of the 201 file the employee keeps up themselves: their profile photo, and the CPD units for their
 * professional license. The license itself comes from the record (license type, set by HR) and the professional
 * license on file (number and expiry, which ends the CPD cycle).
 */
@Injectable()
export class ExtrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
  ) {}

  async photo(employeeId: string) {
    const row = await this.prisma.employeePhoto.findUnique({ where: { employeeId } });
    return { photo: row?.dataUrl ?? null };
  }

  async setPhoto(employeeId: string, input: PhotoInput, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      await tx.employeePhoto.upsert({ where: { employeeId }, create: { employeeId, dataUrl: input.dataUrl }, update: { dataUrl: input.dataUrl } });
      await this.audit.log({ actorId: user.userId, action: 'PHOTO_CHANGED', entity: 'Employee', entityId: employeeId }, tx);
    });
    return { photo: input.dataUrl };
  }

  async removePhoto(employeeId: string, user: AuthUser) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.employeePhoto.deleteMany({ where: { employeeId } });
      if (count) await this.audit.log({ actorId: user.userId, action: 'PHOTO_REMOVED', entity: 'Employee', entityId: employeeId }, tx);
    });
  }

  /** The signed-in employee's license and CPD progress, or null when their role needs no license. */
  async license(employeeId: string) {
    const e = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { employeeNo: true, firstName: true, lastName: true, licenseType: true, cpdUnitsEarned: true },
    });
    if (!e?.licenseType) return null;
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { employeeId, type: 'PROFESSIONAL_LICENSE' },
      orderBy: { uploadedAt: 'desc' },
      select: { referenceNo: true, expiresOn: true },
    });
    const ends = doc?.expiresOn
      ? new Date(`${utcDateToDateKey(doc.expiresOn)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
      : '';
    return {
      id: `license-${e.employeeNo}`,
      employeeId: e.employeeNo,
      employeeName: `${e.firstName} ${e.lastName}`,
      employeeInitials: `${e.firstName[0] ?? ''}${e.lastName[0] ?? ''}`.toUpperCase(),
      // "PRC (CPA)" reads as "CPA" on the card.
      licenseType: e.licenseType.replace(/^PRC\s*\((.+)\)$/i, '$1'),
      licenseNumber: doc?.referenceNo ?? '',
      cpdUnitsEarned: e.cpdUnitsEarned ?? 0,
      cpdUnitsRequired: CPD_UNITS_REQUIRED,
      cycleEndDate: ends,
    };
  }

  async setCpd(employeeId: string, input: CpdUnitsInput, user: AuthUser) {
    const e = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { licenseType: true, cpdUnitsEarned: true } });
    if (!e?.licenseType) throw new ForbiddenException('Your role has no professional license on record');
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id: employeeId }, data: { cpdUnitsEarned: input.cpdUnitsEarned } });
      await this.audit.log({ actorId: user.userId, action: 'CPD_UNITS_LOGGED', entity: 'Employee', entityId: employeeId, before: { cpdUnitsEarned: e.cpdUnitsEarned ?? 0 }, after: { cpdUnitsEarned: input.cpdUnitsEarned } }, tx);
    });
    return this.license(employeeId);
  }

  /** Approvers only see their direct reports' photos. */
  async assertCanSee(user: AuthUser, employeeId: string) {
    if (user.role !== 'MANAGER') return;
    const team = user.employeeId ? await this.employees.teamIds(user.employeeId) : [];
    if (!team.includes(employeeId) && employeeId !== user.employeeId) throw new ForbiddenException('This employee is not on your team');
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Roles(...EVERYONE)
@Controller('me')
export class MyExtrasController {
  constructor(private readonly extras: ExtrasService) {}

  @Get('photo')
  @ApiOperation({ operationId: 'getMyPhoto', summary: 'Your profile photo (null when none)' })
  photo(@CurrentUser() user: AuthUser) {
    return this.extras.photo(requireEmployeeId(user));
  }

  @Put('photo')
  @ApiOperation({ operationId: 'setMyPhoto', summary: 'Change your profile photo (audited)' })
  @ApiZodBody(PhotoInputSchema)
  setPhoto(@CurrentUser() user: AuthUser, @Body(new ZodPipe(PhotoInputSchema)) body: PhotoInput) {
    return this.extras.setPhoto(requireEmployeeId(user), body, user);
  }

  @Delete('photo')
  @HttpCode(204)
  @ApiOperation({ operationId: 'removeMyPhoto', summary: 'Remove your profile photo' })
  async removePhoto(@CurrentUser() user: AuthUser) {
    await this.extras.removePhoto(requireEmployeeId(user), user);
  }

  @Get('license')
  @ApiOperation({ operationId: 'getMyLicense', summary: 'Your professional license and CPD progress (null when your role needs none)' })
  license(@CurrentUser() user: AuthUser) {
    return this.extras.license(requireEmployeeId(user));
  }

  @Put('license/cpd')
  @ApiOperation({ operationId: 'setMyCpdUnits', summary: 'Log your CPD units for the current cycle (audited)' })
  @ApiZodBody(CpdUnitsSchema)
  setCpd(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CpdUnitsSchema)) body: CpdUnitsInput) {
    return this.extras.setCpd(requireEmployeeId(user), body, user);
  }
}

@ApiTags('employees')
@ApiBearerAuth()
@Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN', 'MANAGER')
@Controller('employees')
export class EmployeeExtrasController {
  constructor(private readonly extras: ExtrasService) {}

  @Get(':id/photo')
  @ApiOperation({ operationId: 'getEmployeePhoto', summary: "An employee's profile photo (approvers: their team only)" })
  async photo(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.extras.assertCanSee(user, id);
    return this.extras.photo(id);
  }
}
