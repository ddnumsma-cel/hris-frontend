import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CertificateDeclineSchema, CertificateInputSchema, CertificateSchema } from '@msma/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { CertificatesService } from './certificates.service';

const EVERYONE = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN'] as const;

@ApiTags('requests')
@ApiBearerAuth()
@Roles('HR_ADMIN', 'SYSTEM_ADMIN')
@Controller()
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get('me/certificates')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'myCertificates', summary: 'Your certificate requests' })
  @ApiZodResponse(z.array(CertificateSchema))
  mine(@CurrentUser() user: AuthUser) {
    return this.certificates.mine(user);
  }

  @Post('me/certificates')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'requestCertificate', summary: 'Ask HR for a certificate' })
  @ApiZodBody(CertificateInputSchema)
  @ApiZodResponse(CertificateSchema, 201)
  request(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CertificateInputSchema)) body: { type: string; purpose: string }) {
    return this.certificates.request(body, user);
  }

  @Delete('me/certificates/:id')
  @HttpCode(204)
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'withdrawCertificate', summary: 'Withdraw a request HR has not acted on yet' })
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.certificates.cancel(id, user);
  }

  @Get('certificates')
  @ApiOperation({ operationId: 'certificateRequests', summary: 'HR: every certificate request' })
  @ApiZodResponse(z.array(CertificateSchema))
  all() {
    return this.certificates.all();
  }

  @Post('certificates/:id/issue')
  @HttpCode(200)
  @ApiOperation({ operationId: 'issueCertificate', summary: 'Send a digital copy (numbered and filed)' })
  @ApiZodResponse(CertificateSchema)
  issue(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.certificates.issue(id, user);
  }

  @Post('certificates/:id/ready')
  @HttpCode(200)
  @ApiOperation({ operationId: 'certificateReady', summary: 'A signed copy is ready for pickup' })
  @ApiZodResponse(CertificateSchema)
  ready(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.certificates.ready(id, user);
  }

  @Post('certificates/:id/released')
  @HttpCode(200)
  @ApiOperation({ operationId: 'certificateReleased', summary: 'The signed copy was handed over' })
  @ApiZodResponse(CertificateSchema)
  released(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.certificates.released(id, user);
  }

  @Post('certificates/:id/decline')
  @HttpCode(200)
  @ApiOperation({ operationId: 'declineCertificate', summary: 'Decline with the reason' })
  @ApiZodBody(CertificateDeclineSchema)
  @ApiZodResponse(CertificateSchema)
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(CertificateDeclineSchema)) body: { reason: string }) {
    return this.certificates.decline(id, body.reason, user);
  }
}
