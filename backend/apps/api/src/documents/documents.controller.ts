import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ArchiveDocument,
  ArchiveDocumentSchema,
  DocumentRequirementInput,
  DocumentRequirementSchema,
  DocumentTypeSchema,
  documentType,
  ReturnDocumentSchema,
  DocumentViewsSchema,
  EmployeeDocumentSchema,
  File201Schema,
  MAX_UPLOAD_BYTES,
  RecordsListQuery,
  RecordsListQuerySchema,
  RecordsListResponseSchema,
  RecordsSummaryQuerySchema,
  RecordsSummarySchema,
  UpdateDocument,
  UpdateDocumentSchema,
  UploadDocumentFields,
  UploadDocumentFieldsSchema,
} from '@msma/shared';
import type { Response } from 'express';
import { AuthUser, CurrentUser, requireEmployeeId, Roles } from '../common/auth.decorators';
import { ApiZodBody, ApiZodQuery, ApiZodResponse, openApiSchema, ZodPipe } from '../common/zod';
import { DocumentsService, type UploadedFileData } from './documents.service';
import { NotificationsService } from '../notifications/notifications.service';

const EVERYONE = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN'] as const;

@ApiTags('201 file')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Post('me/documents')
  @Roles(...EVERYONE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 } }))
  @ApiOperation({ operationId: 'submitMyDocument', summary: 'Add one of your own papers (PDF, JPG or PNG, up to 8 MB); HR checks it against the original' })
  @ApiConsumes('multipart/form-data')
  @ApiZodResponse(EmployeeDocumentSchema, 201)
  async submitOwn(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(UploadDocumentFieldsSchema)) fields: UploadDocumentFields,
    @UploadedFile() file: UploadedFileData | undefined,
  ) {
    const doc = await this.documents.submitOwn(user, fields, file);
    await this.notifications.send({ topic: 'documents', kind: 'request', title: `${user.displayName} uploaded their ${documentType(fields.type).label}`, body: 'Check it against the original on the 201 documents page.', roles: ['HR_ADMIN'], actorId: user.userId });
    return doc;
  }

  @Delete('me/documents/:id')
  @HttpCode(204)
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'withdrawMyDocument', summary: 'Take back your own upload before HR reviews it' })
  async withdrawOwn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.documents.withdrawOwn(user, id);
  }

  @Post('documents/:id/verify')
  @HttpCode(200)
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'verifyDocument', summary: "Checked against the original: the employee's upload counts toward their 201 file" })
  async verify(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const r = await this.documents.verify(user, id);
    await this.notifications.send({ topic: 'documents', kind: 'approved', title: `Your ${r.label} was checked`, body: `${user.displayName} verified it against the original. Nothing else to do.`, employeeIds: [r.employeeId], actorId: user.userId });
    return { ok: true };
  }

  @Post('documents/:id/return')
  @HttpCode(200)
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'returnDocument', summary: 'Send an upload back with what to fix (the file is kept in the archive)' })
  @ApiZodBody(ReturnDocumentSchema)
  async sendBack(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReturnDocumentSchema)) body: { note: string }) {
    const r = await this.documents.sendBack(user, id, body.note);
    await this.notifications.send({ topic: 'documents', kind: 'rejected', title: `Your ${r.label} was sent back`, body: `"${body.note}" Upload a new one from your 201 file.`, employeeIds: [r.employeeId], actorId: user.userId });
    return { ok: true };
  }

  @Put('employees/:id/201-file/:type')
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'setDocumentRequirement', summary: 'This paper does not apply to this person, or is required although the usual rule says not' })
  @ApiZodBody(DocumentRequirementSchema)
  async setRequirement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('type') type: string, @Body(new ZodPipe(DocumentRequirementSchema)) body: DocumentRequirementInput) {
    const parsed = DocumentTypeSchema.safeParse(type);
    if (!parsed.success) throw new BadRequestException('Unknown paper');
    await this.documents.setRequirement(user, id, parsed.data, body.state);
    return { ok: true };
  }

  @Get('documents/papers')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'allPapers', summary: "The 201 documents page: every current employee's checklist papers, with what waits for review" })
  allPapers() {
    return this.documents.allPapers();
  }

  @Get('employees/:id/201-file')
  @ApiOperation({
    operationId: 'get201File',
    summary: "An employee's 201 checklist: what is on file, missing or expiring",
    description:
      'HR, Payroll and System Admin: any employee. Managers: their direct reports. Employees: themselves. ' +
      'Documents the caller may not open are counted but not listed.',
  })
  @ApiZodResponse(File201Schema)
  file201(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documents.file201(user, id);
  }

  @Get('me/201-file')
  @ApiOperation({ operationId: 'getMy201File', summary: 'My own 201 checklist (mobile app)' })
  @ApiZodResponse(File201Schema)
  my201File(@CurrentUser() user: AuthUser) {
    return this.documents.file201(user, requireEmployeeId(user));
  }

  @Post('employees/:id/documents')
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 } }),
  )
  @ApiOperation({
    operationId: 'uploadDocument',
    summary: 'Add a scanned document (PDF, JPG or PNG, up to 8 MB) to the 201 file',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type'],
      properties: {
        file: { type: 'string', format: 'binary' },
        ...openApiSchema(UploadDocumentFieldsSchema, 'input').properties,
      },
    },
  })
  @ApiZodResponse(EmployeeDocumentSchema, 201)
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(UploadDocumentFieldsSchema)) fields: UploadDocumentFields,
    @UploadedFile() file: UploadedFileData | undefined,
  ) {
    return this.documents.upload(user, id, fields, file);
  }

  @Get('documents/:id/file')
  @ApiOperation({
    operationId: 'openDocument',
    summary: 'Open a document file. Every opening is recorded in the audit log.',
  })
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png')
  @ApiResponse({ status: 200, schema: { type: 'string', format: 'binary' } })
  async open(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.documents.open(user, id);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
    });
    return new StreamableFile(file.data);
  }

  @Patch('documents/:id')
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'updateDocument', summary: 'Correct dates, reference or notes' })
  @ApiZodBody(UpdateDocumentSchema)
  @ApiZodResponse(EmployeeDocumentSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateDocumentSchema)) body: UpdateDocument,
  ) {
    return this.documents.update(user, id, body);
  }

  @Post('documents/:id/archive')
  @HttpCode(204)
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'archiveDocument',
    summary: 'Remove a document from the 201 file (kept in the archive, with the reason)',
  })
  @ApiZodBody(ArchiveDocumentSchema)
  @ApiResponse({ status: 204, description: 'Archived' })
  async archive(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(ArchiveDocumentSchema)) body: ArchiveDocument,
  ) {
    await this.documents.archive(user, id, body.reason);
  }

  @Get('documents/:id/views')
  @Roles('HR_ADMIN')
  @ApiOperation({
    operationId: 'getDocumentViews',
    summary: 'Who uploaded, changed, opened or removed this document',
  })
  @ApiZodResponse(DocumentViewsSchema)
  views(@Param('id') id: string) {
    return this.documents.views(id);
  }

  @Get('records')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'list201Files',
    summary: '201 files of all employees: completeness, missing items, next expiry',
  })
  @ApiZodQuery(RecordsListQuerySchema)
  @ApiZodResponse(RecordsListResponseSchema)
  list(@Query(new ZodPipe(RecordsListQuerySchema)) q: RecordsListQuery) {
    return this.documents.list(q);
  }

  @Get('records/summary')
  @Roles('HR_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({
    operationId: 'get201Summary',
    summary: 'Dashboard numbers: complete 201 files, renewals due, most-missing documents',
  })
  @ApiZodQuery(RecordsSummaryQuerySchema)
  @ApiZodResponse(RecordsSummarySchema)
  summary(@Query(new ZodPipe(RecordsSummaryQuerySchema)) q: { siteId?: string }) {
    return this.documents.summary(q.siteId);
  }
}
