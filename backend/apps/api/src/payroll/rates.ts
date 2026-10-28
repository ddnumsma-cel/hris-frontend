import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, NotFoundException, Param, ParseEnumPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { manilaToday, RATE_AGENCIES, RateAgency, RateVersionInput, RateVersionInputSchema, RATES_SCHEMAS } from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';

const KEY = 'payroll-rates';

type Version = { id: string; effectiveFrom: string; source: string; rates: unknown; savedBy: string; savedAt: string };
type Book = Record<RateAgency, Version[]>;
const EMPTY: Book = { sss: [], philhealth: [], pagibig: [], bir: [] };

/**
 * Government contribution and withholding tax rates (Payroll › Government contributions), as dated versions:
 * a new circular is a new version with its effective date, never an edit, so past pay can still be worked out.
 * Until a version is saved for an agency, the website uses its built-in rates.
 */
@Injectable()
export class RatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async book(): Promise<Book> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: KEY } });
    return { ...EMPTY, ...((row?.value as Partial<Book> | null) ?? {}) };
  }

  private async write(book: Book) {
    await this.prisma.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: book as object }, update: { value: book as object } });
  }

  async add(agency: RateAgency, input: RateVersionInput, user: AuthUser) {
    const parsed = RATES_SCHEMAS[agency].safeParse(input.rates);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Check the rates');
    const book = await this.book();
    const today = manilaToday();
    const current = [...book[agency]].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).find((v) => v.effectiveFrom <= today);
    if (current && input.effectiveFrom < current.effectiveFrom)
      throw new BadRequestException(`Rates from ${current.effectiveFrom} already apply. New rates must take effect on or after that date.`);
    // A version on the same date replaces it (a correction before it applies); one already in force can't be changed.
    const same = book[agency].find((v) => v.effectiveFrom === input.effectiveFrom);
    if (same && same.effectiveFrom <= today) throw new ConflictException('Rates already in force stay on record. Add a new version with a later date.');
    const v: Version = { id: `${agency}-${Date.now().toString(36)}`, effectiveFrom: input.effectiveFrom, source: input.source, rates: parsed.data, savedBy: user.displayName, savedAt: new Date().toISOString() };
    const next = { ...book, [agency]: [...book[agency].filter((x) => x.effectiveFrom !== input.effectiveFrom), v] };
    await this.write(next);
    await this.audit.log({ actorId: user.userId, action: 'CONTRIBUTION_RATES_SAVED', entity: 'Settings', entityId: `${KEY}:${agency}`, after: { effectiveFrom: v.effectiveFrom, source: v.source } });
    return v;
  }

  async remove(agency: RateAgency, id: string, user: AuthUser) {
    const book = await this.book();
    const v = book[agency].find((x) => x.id === id);
    if (!v) throw new NotFoundException('That version no longer exists');
    if (v.effectiveFrom <= manilaToday()) throw new ConflictException("Rates already in force stay on record and can't be removed");
    await this.write({ ...book, [agency]: book[agency].filter((x) => x.id !== id) });
    await this.audit.log({ actorId: user.userId, action: 'CONTRIBUTION_RATES_REMOVED', entity: 'Settings', entityId: `${KEY}:${agency}`, before: { effectiveFrom: v.effectiveFrom, source: v.source } });
  }
}

@ApiTags('payroll')
@ApiBearerAuth()
@Controller('payroll/rates')
export class RatesController {
  constructor(private readonly rates: RatesService) {}

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'contributionRates', summary: 'Saved SSS, PhilHealth, Pag-IBIG and BIR rate versions (the website has built-in ones until then)' })
  book() {
    return this.rates.book();
  }

  @Post(':agency')
  @Roles('PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'saveContributionRates', summary: 'Add a rate version with its effective date and source' })
  @ApiZodBody(RateVersionInputSchema)
  add(@CurrentUser() user: AuthUser, @Param('agency', new ParseEnumPipe(RATE_AGENCIES)) agency: RateAgency, @Body(new ZodPipe(RateVersionInputSchema)) body: RateVersionInput) {
    return this.rates.add(agency, body, user);
  }

  @Delete(':agency/:id')
  @HttpCode(204)
  @Roles('PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'removeContributionRates', summary: 'Remove a rate version that has not taken effect yet' })
  async remove(@CurrentUser() user: AuthUser, @Param('agency', new ParseEnumPipe(RATE_AGENCIES)) agency: RateAgency, @Param('id') id: string) {
    await this.rates.remove(agency, id, user);
  }
}
