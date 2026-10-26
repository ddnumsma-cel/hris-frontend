import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  OrgDepartmentSchema,
  OrgLocationSchema,
  SaveDepartment,
  SaveDepartmentSchema,
  SaveLocation,
  SaveLocationSchema,
  SaveShift,
  SaveShiftSchema,
  SetActive,
  SetActiveSchema,
  SetUsualShift,
  SetUsualShiftSchema,
  ShiftBriefSchema,
} from '@msma/shared';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { OrgService } from './org.service';

/** Maintenance › Locations and Departments. Everyone with an HR, payroll or manager login can read; HR and System Admin change. */
@ApiTags('maintenance')
@ApiBearerAuth()
@Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN', 'MANAGER')
@Controller('org')
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Get('locations')
  @ApiOperation({ operationId: 'listLocations', summary: 'Offices with their contact, manager, headcount and departments' })
  @ApiZodResponse(z.array(OrgLocationSchema))
  locations() {
    return this.org.locations();
  }

  @Post('locations')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'createLocation', summary: 'Add an office' })
  @ApiZodBody(SaveLocationSchema)
  @ApiZodResponse(OrgLocationSchema, 201)
  @ApiResponse({ status: 409, description: 'Another office has that name or code' })
  createLocation(@CurrentUser() user: AuthUser, @Body(new ZodPipe(SaveLocationSchema)) body: SaveLocation) {
    return this.org.saveLocation(null, body, user.userId);
  }

  @Put('locations/:id')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'updateLocation', summary: "Edit an office's code, address, contact or manager (not its name)" })
  @ApiZodBody(SaveLocationSchema)
  @ApiZodResponse(OrgLocationSchema)
  updateLocation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(SaveLocationSchema)) body: SaveLocation,
  ) {
    return this.org.saveLocation(id, body, user.userId);
  }

  @Patch('locations/:id/active')
  @HttpCode(204)
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'setLocationActive', summary: 'Deactivate (only when nobody works there) or reactivate an office' })
  @ApiZodBody(SetActiveSchema)
  @ApiResponse({ status: 409, description: 'People still work there' })
  async setLocationActive(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(SetActiveSchema)) body: SetActive,
  ) {
    await this.org.setLocationActive(id, body.active, user.userId);
  }

  @Get('departments')
  @ApiOperation({ operationId: 'listDepartments', summary: 'Departments at each office, with their head and headcount' })
  @ApiZodResponse(z.array(OrgDepartmentSchema))
  departments() {
    return this.org.departments();
  }

  @Post('departments')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'createDepartment', summary: 'Add a department at an office' })
  @ApiZodBody(SaveDepartmentSchema)
  @ApiZodResponse(OrgDepartmentSchema, 201)
  @ApiResponse({ status: 409, description: 'The office already has it, or the name/code is taken' })
  createDepartment(@CurrentUser() user: AuthUser, @Body(new ZodPipe(SaveDepartmentSchema)) body: SaveDepartment) {
    return this.org.saveDepartment(null, body, user.userId);
  }

  @Put('departments/:id')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'updateDepartment', summary: "Edit a department's name, code or head (id = office id:department id)" })
  @ApiZodBody(SaveDepartmentSchema)
  @ApiZodResponse(OrgDepartmentSchema)
  updateDepartment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(SaveDepartmentSchema)) body: SaveDepartment,
  ) {
    return this.org.saveDepartment(id, body, user.userId);
  }

  @Patch('departments/:id/active')
  @HttpCode(204)
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'setDepartmentActive', summary: 'Deactivate (only when empty) or reactivate a department at an office' })
  @ApiZodBody(SetActiveSchema)
  @ApiResponse({ status: 409, description: 'People are still in it' })
  async setDepartmentActive(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(SetActiveSchema)) body: SetActive,
  ) {
    await this.org.setDepartmentActive(id, body.active, user.userId);
  }

  @Get('shifts')
  @ApiOperation({ operationId: 'listShifts', summary: 'Shifts with their lunch, grace, work days and how many people are on each' })
  @ApiZodResponse(z.array(ShiftBriefSchema))
  shifts() {
    return this.org.shifts();
  }

  @Post('shifts')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'createShift', summary: 'Add a shift' })
  @ApiZodBody(SaveShiftSchema)
  @ApiZodResponse(ShiftBriefSchema, 201)
  createShift(@CurrentUser() user: AuthUser, @Body(new ZodPipe(SaveShiftSchema)) body: SaveShift) {
    return this.org.saveShift(null, body, user.userId);
  }

  @Put('shifts/:id')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'updateShift',
    summary: 'Edit a shift (or turn it off when nobody is on it); today is recalculated for everyone on it',
  })
  @ApiZodBody(SaveShiftSchema)
  @ApiZodResponse(ShiftBriefSchema)
  updateShift(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(SaveShiftSchema)) body: SaveShift) {
    return this.org.saveShift(id, body, user.userId);
  }

  @Put('usual-shift')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'setUsualShift', summary: "Put people on a usual shift from today (today's attendance is recalculated)" })
  @ApiZodBody(SetUsualShiftSchema)
  @ApiZodResponse(z.object({ updated: z.number().int() }))
  setUsualShift(@CurrentUser() user: AuthUser, @Body(new ZodPipe(SetUsualShiftSchema)) body: SetUsualShift) {
    return this.org.setUsualShift(body.employeeIds, body.shiftId, user.userId);
  }
}
