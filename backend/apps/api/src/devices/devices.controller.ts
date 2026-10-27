import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DeviceCommandSchema,
  DeviceStatusSchema,
  DeviceSyncPlanSchema,
  DeviceSyncRequest,
  DeviceSyncRequestSchema,
} from '@msma/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { DevicesService } from './devices.service';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN', 'MANAGER')
  @ApiOperation({
    operationId: 'listDevices',
    summary: 'Biometric terminals and online status (seen within 5 minutes)',
  })
  @ApiZodResponse(z.array(DeviceStatusSchema))
  list() {
    return this.devices.status();
  }

  @Post(':serial/refresh-users')
  @HttpCode(204)
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'refreshDeviceUsers',
    summary: 'Ask a terminal for its user list (it answers on its next check-in)',
  })
  async refreshUsers(@CurrentUser() user: AuthUser, @Param('serial') serial: string) {
    await this.devices.refreshUsers(serial, user.userId);
  }

  @Get(':serial/sync-plan')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'getDeviceSyncPlan',
    summary: "Who syncing would add to and delete from a terminal's user list (nothing is sent)",
  })
  @ApiZodResponse(DeviceSyncPlanSchema)
  syncPlan(@Param('serial') serial: string) {
    return this.devices.syncPlan(serial);
  }

  @Post(':serial/sync')
  @HttpCode(200)
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'syncDeviceUsers',
    summary:
      'Add active employees missing from the terminal; with deleteExtras, also delete its users who are not active employees. Never clears the terminal.',
  })
  @ApiZodBody(DeviceSyncRequestSchema)
  @ApiZodResponse(DeviceSyncPlanSchema)
  sync(
    @CurrentUser() user: AuthUser,
    @Param('serial') serial: string,
    @Body(new ZodPipe(DeviceSyncRequestSchema)) body: DeviceSyncRequest,
  ) {
    return this.devices.sync(serial, body.deleteExtras, user.userId);
  }

  @Get(':serial/commands')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'listDeviceCommands', summary: "A terminal's last 50 commands and their results" })
  @ApiZodResponse(z.array(DeviceCommandSchema))
  commands(@Param('serial') serial: string) {
    return this.devices.recentCommands(serial);
  }
}
