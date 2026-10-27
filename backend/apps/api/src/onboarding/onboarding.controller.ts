import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApplicantSchema,
  ApplicantStageSchema,
  ApplicationInput,
  ApplicationInputSchema,
  RequisitionInput,
  RequisitionInputSchema,
  RequisitionSchema,
  TrainingInput,
  TrainingInputSchema,
  TrainingSchema,
  TrainingStatusSchema,
} from '@msma/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/zod';
import { EmployeesService } from '../employees/employees.service';
import { OnboardingService } from './onboarding.service';

const EVERYONE = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN'] as const;

@ApiTags('onboarding')
@ApiBearerAuth()
@Roles('HR_ADMIN', 'SYSTEM_ADMIN')
@Controller()
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly employees: EmployeesService,
  ) {}

  // ---------- Recruitment (HR) ----------

  @Get('recruitment/requisitions')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN', 'MANAGER')
  @ApiOperation({ operationId: 'listRequisitions', summary: 'Job requisitions with their applicant counts' })
  @ApiZodResponse(z.array(RequisitionSchema))
  requisitions() {
    return this.onboarding.requisitions();
  }

  @Post('recruitment/requisitions')
  @ApiOperation({ operationId: 'addRequisition', summary: 'A new job requisition (starts with the Partner, Pending L1)' })
  @ApiZodBody(RequisitionInputSchema)
  @ApiZodResponse(RequisitionSchema, 201)
  addRequisition(@CurrentUser() user: AuthUser, @Body(new ZodPipe(RequisitionInputSchema)) body: RequisitionInput) {
    return this.onboarding.createRequisition(body, user);
  }

  @Get('recruitment/applicants')
  @ApiOperation({ operationId: 'listApplicants', summary: 'Every applicant, newest first' })
  @ApiZodResponse(z.array(ApplicantSchema))
  applicants() {
    return this.onboarding.applicants();
  }

  @Put('recruitment/applicants/:id/stage')
  @ApiOperation({ operationId: 'moveApplicant', summary: 'Move an applicant to another stage of the pipeline' })
  @ApiZodBody(ApplicantStageSchema)
  @ApiZodResponse(ApplicantSchema)
  move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ApplicantStageSchema)) body: { stage: string }) {
    return this.onboarding.moveApplicant(id, body.stage, user);
  }

  // ---------- Trainings ----------

  @Get('trainings')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN', 'MANAGER')
  @ApiOperation({ operationId: 'listTrainings', summary: 'Assigned trainings (HR: everyone; managers: their team)' })
  @ApiZodResponse(z.array(TrainingSchema))
  async trainings(@CurrentUser() user: AuthUser) {
    const team = user.role === 'MANAGER' && user.employeeId ? await this.employees.teamIds(user.employeeId) : undefined;
    return this.onboarding.trainings(user, team);
  }

  @Post('trainings')
  @ApiOperation({ operationId: 'assignTraining', summary: 'Assign a training to an employee' })
  @ApiZodBody(TrainingInputSchema)
  @ApiZodResponse(TrainingSchema, 201)
  assign(@CurrentUser() user: AuthUser, @Body(new ZodPipe(TrainingInputSchema)) body: TrainingInput) {
    return this.onboarding.assignTraining(body, user);
  }

  @Put('trainings/:id/status')
  @ApiOperation({ operationId: 'setTrainingStatus', summary: 'Set where a training is: not started, in progress or completed' })
  @ApiZodBody(TrainingStatusSchema)
  @ApiZodResponse(TrainingSchema)
  status(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(TrainingStatusSchema)) body: { status: string }) {
    return this.onboarding.setTrainingStatus(id, body.status, user, false);
  }

  @Delete('trainings/:id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'removeTraining', summary: 'Remove an assigned training' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.onboarding.removeTraining(id, user);
  }

  @Get('me/trainings')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'myTrainings', summary: 'The trainings assigned to the signed-in employee' })
  @ApiZodResponse(z.array(TrainingSchema))
  mine(@CurrentUser() user: AuthUser) {
    return this.onboarding.trainings({ ...user, role: 'EMPLOYEE' });
  }

  @Put('me/trainings/:id/status')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'updateMyTraining', summary: 'Mark your own training started or completed (never back)' })
  @ApiZodBody(TrainingStatusSchema)
  @ApiZodResponse(TrainingSchema)
  myStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(TrainingStatusSchema)) body: { status: string }) {
    return this.onboarding.setTrainingStatus(id, body.status, user, true);
  }
}

/** The shared job link: no sign-in, so no role list here (a controller-wide @Roles would still apply to @Public routes). */
@ApiTags('onboarding')
@Controller('careers')
export class CareersController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Public()
  @Get('openings')
  @ApiOperation({ operationId: 'openRoles', summary: 'Roles open to the public: approved and still hiring' })
  @ApiZodResponse(z.array(RequisitionSchema))
  openings() {
    return this.onboarding.requisitions(true);
  }

  @Public()
  @Post('applications')
  @ApiOperation({ operationId: 'apply', summary: 'Apply through the shared job link (limited to 200 applications an hour in all)' })
  @ApiZodBody(ApplicationInputSchema)
  @ApiZodResponse(ApplicantSchema, 201)
  @ApiResponse({ status: 409, description: 'Already applied for this role with this email' })
  @ApiResponse({ status: 429, description: 'Too many applications right now' })
  apply(@Body(new ZodPipe(ApplicationInputSchema)) body: ApplicationInput) {
    return this.onboarding.apply(body);
  }
}
