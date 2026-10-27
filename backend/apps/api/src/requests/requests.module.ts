import { Module } from '@nestjs/common';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';

/** Requests on the website: reimbursements (and certificates). */
@Module({
  controllers: [ClaimsController, CertificatesController],
  providers: [ClaimsService, CertificatesService],
})
export class RequestsModule {}
