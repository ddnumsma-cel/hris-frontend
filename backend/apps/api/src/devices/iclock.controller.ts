import { Body, Controller, Get, Header, HttpCode, Ip, Post, Query } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { IclockQuery, IclockQuerySchema } from '@msma/shared';
import { Public } from '../common/auth.decorators';
import { ApiZodQuery, ZodPipe } from '../common/zod';
import { DevicesService } from './devices.service';

/**
 * ZKTeco ADMS push endpoints. Terminals can't send JWTs, so these are public but only accept
 * registered serial numbers. (Production: put behind the site VPN / IP allow-list.)
 */
@ApiTags('devices')
@Public()
@Controller('iclock')
export class IclockController {
  constructor(private readonly devices: DevicesService) {}

  @Get('cdata')
  @Header('Content-Type', 'text/plain')
  @ApiOperation({
    operationId: 'iclockHandshake',
    summary: 'Terminal handshake (returns ADMS options)',
  })
  @ApiZodQuery(IclockQuerySchema)
  @ApiProduces('text/plain')
  async handshake(@Query(new ZodPipe(IclockQuerySchema)) q: IclockQuery, @Ip() ip: string) {
    await this.devices.touch(q.SN, ip);
    return this.devices.handshake(q.SN);
  }

  @Post('cdata')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  @ApiOperation({
    operationId: 'iclockUpload',
    summary: 'Attendance upload (ATTLOG lines). Idempotent; returns "OK"',
  })
  @ApiZodQuery(IclockQuerySchema)
  @ApiConsumes('text/plain')
  @ApiProduces('text/plain')
  @ApiBody({ schema: { type: 'string', example: '1001\t2026-09-25 07:58:12\t0\t15\t0\t0' } })
  async upload(
    @Query(new ZodPipe(IclockQuerySchema)) q: IclockQuery,
    @Body() body: unknown,
    @Ip() ip: string,
  ) {
    await this.devices.ingest(q.SN, q.table, typeof body === 'string' ? body : '', ip);
    return 'OK';
  }

  @Get('getrequest')
  @Header('Content-Type', 'text/plain')
  @ApiOperation({
    operationId: 'iclockHeartbeat',
    summary: 'Terminal heartbeat / command poll (no commands in the sample)',
  })
  @ApiZodQuery(IclockQuerySchema)
  @ApiProduces('text/plain')
  async heartbeat(@Query(new ZodPipe(IclockQuerySchema)) q: IclockQuery, @Ip() ip: string) {
    await this.devices.touch(q.SN, ip);
    return 'OK';
  }
}
