import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
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

@ApiTags('201 file')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

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
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN')
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
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN')
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
  @Roles('HR_ADMIN', 'PAYROLL_ADMIN')
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
