// The Sep 11 – 25, 2026 run against MSMA's FT_MSMA payroll register: every take-home must match to the centavo.
// Run: npm run check:register   (starts from fresh demo data each time)

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};
store.set("msma-hris-account", "ua-accounting");
const runs = await import("../src/lib/pay/runs");
const reg = await import("../src/lib/pay/register");
const { MSMA_ROSTER } = await import("../src/lib/msmaRoster");

let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => { if (!ok) failed++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(extra)); };
const peso = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

check("every register name is a person in heyhr", reg.unmatchedRegisterRows().length === 0, reg.unmatchedRegisterRows());

const { from, to } = reg.REGISTER_PERIOD;
const run = await runs.createRun({ id: from, label: "Sep 11 – 25, 2026", from, to }, "Accounting (demo)");
let total = 0;
let expected = 0;
for (const r of MSMA_ROSTER) {
  const row = reg.registerRow(r.id, from, to)!;
  const line = run.lines.find((l) => l.person.id === r.id);
  expected += row.net;
  if (!line) {
    // Only the ₱0 salary (on study leave) is left off a run.
    check(`${r.lastName}, ${r.firstName}: not on the run (register net ₱${peso(row.net)})`, row.net === 0, row);
    continue;
  }
  total += line.net;
  check(`${r.lastName}, ${r.firstName}: ₱${peso(line.net)}`, Math.abs(line.net - row.net) < 0.005, { heyhr: line.net, register: row.net, tax: line.tax, contributions: line.pay.contributions });
}
check(`run total ₱${peso(total)} = register total ₱${peso(expected)} (FT_MSMA: ₱499,786.25)`, Math.abs(total - 499786.25) < 0.005 && Math.abs(expected - 499786.25) < 0.005);

console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
