import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/auth.decorators';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ operationId: 'health' })
  @ApiOkResponse({ description: 'API is up' })
  health() {
    return { status: 'ok', service: 'msma-hris-api', time: new Date().toISOString() };
  }
}
