import { Module } from '@nestjs/common';
import { AdministrationController } from './administration.controller';
import { AuditTrailService } from './audit-trail.service';
import { SubscriptionService } from './subscription.service';
import { SupportService } from './support.service';

/** Administration on the website: the audit trail, support tickets and the subscription (plan and seats). */
@Module({
  controllers: [AdministrationController],
  providers: [AuditTrailService, SupportService, SubscriptionService],
  exports: [SubscriptionService],
})
export class AdministrationModule {}
