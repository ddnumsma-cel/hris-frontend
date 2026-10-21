/**
 * Recompute daily time records from raw punches (runs at the end of `pnpm db:seed`).
 * Usage: node dist/cli/recompute.js [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 * Defaults: from the earliest punch to today (Manila).
 */
import '../load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { printRowCounts } from '@msma/db';
import { formatDate, manilaDateKey, manilaToday } from '@msma/shared';
import { AppModule } from '../app.module';
import { AttendanceService } from '../attendance/attendance.service';
import { PrismaService } from '../prisma/prisma.service';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const first = await prisma.rawPunch.findFirst({
    orderBy: { punchedAt: 'asc' },
    select: { punchedAt: true },
  });
  const from = arg('from') ?? (first ? manilaDateKey(first.punchedAt) : manilaToday());
  const to = arg('to') ?? manilaToday();
  const started = Date.now();
  const result = await app.get(AttendanceService).recompute(from, to);
  console.log(
    `Recomputed ${result.records} daily time records for ${result.employees} employees, ${formatDate(from)} to ${formatDate(to)} (${Date.now() - started} ms).`,
  );
  await printRowCounts(prisma);
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
