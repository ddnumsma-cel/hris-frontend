import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnnouncementInput, AnnouncementInputSchema } from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';

/** "Posted Oct 28, 2026", as the website writes it. */
const postedOn = (d: Date) => `Posted ${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}`;

/** Company announcements: HR and the Super Admin post them; everyone sees them on their Home and in the bell. */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.prisma.announcement.findMany({ where: { removedAt: null }, orderBy: { postedAt: 'desc' }, take: 50 });
    return rows.map((a) => ({ id: a.id, title: a.title, ...(a.body ? { body: a.body } : {}), postedOn: postedOn(a.postedAt), postedBy: a.postedBy }));
  }

  async post(input: AnnouncementInput, user: AuthUser) {
    const a = await this.prisma.$transaction(async (tx) => {
      const row = await tx.announcement.create({ data: { title: input.title, body: input.body || null, postedBy: user.displayName, postedById: user.userId } });
      await this.audit.log({ actorId: user.userId, action: 'ANNOUNCEMENT_POSTED', entity: 'Announcement', entityId: row.id, after: { title: row.title } }, tx);
      return row;
    });
    return { id: a.id, title: a.title, ...(a.body ? { body: a.body } : {}), postedOn: postedOn(a.postedAt), postedBy: a.postedBy };
  }

  /** Taken down (kept for the record). */
  async remove(id: string, user: AuthUser) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a || a.removedAt) throw new NotFoundException('That announcement is no longer posted');
    await this.prisma.$transaction(async (tx) => {
      await tx.announcement.update({ where: { id }, data: { removedAt: new Date() } });
      await this.audit.log({ actorId: user.userId, action: 'ANNOUNCEMENT_REMOVED', entity: 'Announcement', entityId: id, before: { title: a.title } }, tx);
    });
  }
}

@ApiTags('announcements')
@ApiBearerAuth()
@Roles('HR_ADMIN', 'SYSTEM_ADMIN')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'listAnnouncements', summary: 'Company announcements, newest first' })
  list() {
    return this.announcements.list();
  }

  @Post()
  @ApiOperation({ operationId: 'postAnnouncement', summary: 'Post an announcement to everyone' })
  @ApiZodBody(AnnouncementInputSchema)
  post(@CurrentUser() user: AuthUser, @Body(new ZodPipe(AnnouncementInputSchema)) body: AnnouncementInput) {
    return this.announcements.post(body, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'removeAnnouncement', summary: 'Take an announcement down (kept for the record)' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.announcements.remove(id, user);
  }
}

@Module({ controllers: [AnnouncementsController], providers: [AnnouncementsService] })
export class AnnouncementsModule {}
