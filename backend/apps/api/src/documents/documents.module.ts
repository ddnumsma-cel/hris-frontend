import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { DocumentStorage, LocalDiskStorage } from './document-storage';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

/** The 201 file: document checklist, uploads, restricted access and the view log. */
@Module({
  imports: [EmployeesModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, { provide: DocumentStorage, useClass: LocalDiskStorage }],
  exports: [DocumentsService],
})
export class DocumentsModule {}
