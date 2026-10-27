import { Body, Controller, Get, Header, HttpCode, Ip, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { IclockQuery, IclockQuerySchema } from '@msma/shared';
import { Public } from '../common/auth.decorators';
import { LanOnlyGuard } from '../common/lan-only.guard';
import { ApiZodQuery, ZodPipe } from '../common/zod';
import { DevicesService } from './devices.service';

/**
 * ZKTeco ADMS push endpoints. Terminals can't send JWTs, so these are public but only accept registered serial
 * numbers, and only from the office network (LanOnlyGuard; ICLOCK_ALLOWED_IPS adds a site's own address).
 */
@ApiTags('devices')
@Public()
@UseGuards(LanOnlyGuard)
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
    summary: 'Terminal heartbeat / command poll: replies with waiting commands ("C:<id>:<command>" lines) or "OK"',
  })
  @ApiZodQuery(IclockQuerySchema)
  @ApiProduces('text/plain')
  async heartbeat(@Query(new ZodPipe(IclockQuerySchema)) q: IclockQuery, @Ip() ip: string) {
    await this.devices.touch(q.SN, ip);
    return this.devices.commandsFor(q.SN);
  }

  @Post('devicecmd')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  @ApiOperation({
    operationId: 'iclockCommandReply',
    summary: 'Terminal reports command results ("ID=<id>&Return=<code>&CMD=..." lines; 0 = done)',
  })
  @ApiZodQuery(IclockQuerySchema)
  @ApiConsumes('text/plain')
  @ApiProduces('text/plain')
  async commandReply(
    @Query(new ZodPipe(IclockQuerySchema)) q: IclockQuery,
    @Body() body: unknown,
    @Ip() ip: string,
  ) {
    await this.devices.commandReplies(q.SN, typeof body === 'string' ? body : '', ip);
    return 'OK';
  }

  @Post('querydata')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  @ApiOperation({
    operationId: 'iclockQueryData',
    summary: 'Terminal answers a data query (newer firmware sends its user list here)',
  })
  @ApiZodQuery(IclockQuerySchema)
  @ApiConsumes('text/plain')
  @ApiProduces('text/plain')
  async queryData(
    @Query(new ZodPipe(IclockQuerySchema)) q: IclockQuery,
    @Body() body: unknown,
    @Ip() ip: string,
  ) {
    await this.devices.touch(q.SN, ip);
    await this.devices.recordUsers(q.SN, typeof body === 'string' ? body : '');
    return 'OK';
  }
}
