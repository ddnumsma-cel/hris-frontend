import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AddHoliday,
  AddHolidaySchema,
  ChangeHoliday,
  ChangeHolidaySchema,
  HolidayCalendar,
  HolidayCalendarSchema,
  HolidayChangeSchema,
  HolidayRuleSchema,
  SavedHolidaysSchema,
} from '@msma/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { HolidaysService } from './holidays.service';

@ApiTags('holidays')
@ApiBearerAuth()
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  @ApiOperation({ operationId: 'listSavedHolidays', summary: 'Holidays HR added and the yearly moves or cancellations (national ones are built into the website)' })
  @ApiZodResponse(SavedHolidaysSchema)
  list() {
    return this.holidays.saved();
  }

  @Post()
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'addHoliday', summary: 'Add a company or local holiday, once or every year' })
  @ApiZodBody(AddHolidaySchema)
  @ApiZodResponse(HolidayRuleSchema, 201)
  add(@CurrentUser() user: AuthUser, @Body(new ZodPipe(AddHolidaySchema)) body: AddHoliday) {
    return this.holidays.add(body, user);
  }

  @Put('changes')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'changeHolidayForYear', summary: 'Move a holiday or cancel it for one year (from a proclamation)' })
  @ApiZodBody(ChangeHolidaySchema)
  @ApiZodResponse(HolidayChangeSchema)
  change(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ChangeHolidaySchema)) body: ChangeHoliday) {
    return this.holidays.change(body, user);
  }

  @Put('calendar')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'setHolidayCalendar', summary: "The year's holidays as the website works them out, so the backend's day records mark them" })
  @ApiZodBody(HolidayCalendarSchema)
  @ApiZodResponse(z.object({ holidays: z.number().int() }))
  calendar(@Body(new ZodPipe(HolidayCalendarSchema)) body: HolidayCalendar) {
    return this.holidays.setCalendar(body);
  }

  @Delete('changes/:ruleId/:year')
  @HttpCode(204)
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'undoHolidayChange', summary: 'Put a holiday back on its usual date for that year' })
  async undo(@CurrentUser() user: AuthUser, @Param('ruleId') ruleId: string, @Param('year', ParseIntPipe) year: number) {
    await this.holidays.undoChange(ruleId, year, user);
  }

  @Delete(':ruleId')
  @HttpCode(204)
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'removeHoliday', summary: 'Delete a holiday HR added' })
  async remove(@CurrentUser() user: AuthUser, @Param('ruleId') ruleId: string) {
    await this.holidays.remove(ruleId, user);
  }
}
