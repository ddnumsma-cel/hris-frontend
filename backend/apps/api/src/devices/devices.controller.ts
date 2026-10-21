import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeviceStatusSchema } from '@msma/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.decorators';
import { ApiZodResponse } from '../common/zod';
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
}
