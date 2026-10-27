import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { CareersController, OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

/** Recruitment (job requisitions, applicants from the shared job link) and assigned trainings. */
@Module({
  imports: [EmployeesModule],
  controllers: [OnboardingController, CareersController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
