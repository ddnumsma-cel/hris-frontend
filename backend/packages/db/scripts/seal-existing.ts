// Encrypts the government and bank numbers saved before encryption came in (run once; running it again changes
// nothing). Back up the database first. Usage: pnpm --filter @msma/db seal:existing
import { PrismaClient } from '@prisma/client';
import { assertDataKey, isSealed, seal, sealGovIds, unseal } from '../src/sealed';

async function main() {
  assertDataKey();
  const prisma = new PrismaClient();
  try {
    const ids = await prisma.govId.findMany();
    let govRows = 0;
    for (const g of ids) {
      if ([g.tin, g.sss, g.philhealth, g.pagibig].every((v) => !v || isSealed(v))) continue;
      const sealed = sealGovIds(g);
      // Read it back before saving: a wrong key never leaves numbers that can't be decrypted.
      if (unseal(sealed.tin) !== g.tin || unseal(sealed.sss) !== g.sss || unseal(sealed.philhealth) !== g.philhealth || unseal(sealed.pagibig) !== g.pagibig)
        throw new Error(`Encryption check failed for government numbers ${g.id}; nothing more was changed.`);
      await prisma.govId.update({ where: { id: g.id }, data: { tin: sealed.tin, sss: sealed.sss, philhealth: sealed.philhealth, pagibig: sealed.pagibig } });
      govRows++;
    }
    const banks = await prisma.employee.findMany({ where: { bankAccountNo: { not: null } }, select: { id: true, bankAccountNo: true } });
    let bankRows = 0;
    for (const e of banks) {
      if (!e.bankAccountNo || isSealed(e.bankAccountNo)) continue;
      const sealed = seal(e.bankAccountNo);
      if (unseal(sealed) !== e.bankAccountNo) throw new Error(`Encryption check failed for a bank account (${e.id}); nothing more was changed.`);
      await prisma.employee.update({ where: { id: e.id }, data: { bankAccountNo: sealed } });
      bankRows++;
    }
    console.log(`Encrypted government numbers of ${govRows} employee(s) and ${bankRows} bank account number(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
