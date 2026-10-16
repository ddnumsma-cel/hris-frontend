import { admin } from "@/lib/admin/store";
import type { MyPayslip } from "@/lib/ess/api";
import { escapeHtml, openPrintDocument } from "@/lib/printDocument";

// The printed payslip, following MSMA's payroll workbook (sheet PS_MSMA_v7) line for line: two
// copies side by side (the employee keeps one, signs and returns the other), each with the
// company header, the cut-off, gross pay, deductions, net pay, the signature lines and the
// vacation days left. Colours are the MSMA logo's navy and lime.

const money = (n: number) => (n ? n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–");
const long = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric" });

const STYLES = `
  /* Both copies on one A4 landscape page. */
  @page { size: A4 landscape; margin: 7mm; }
  html, body { height: auto; }
  body { padding: 0 !important; color: #1b2433; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; break-inside: avoid; page-break-inside: avoid; }
  .slip { border: 1px solid #d5dbe5; border-radius: 12px; overflow: hidden; font-size: 9.5px; line-height: 1.25; display: flex; flex-direction: column; }
  .top { display: flex; align-items: center; gap: 10px; padding: 7px 14px; border-bottom: 3px solid #a6c93a; }
  .top img { height: 34px; width: auto; }
  .co { flex: 1; }
  .co b { display: block; font-size: 12px; color: #13254f; }
  .co span { color: #5b6678; font-size: 9.5px; }
  .tag { text-align: right; }
  .tag b { display: block; font-size: 13px; letter-spacing: 0.14em; color: #13254f; }
  .tag span { font-size: 9.5px; color: #5b6678; }
  .who { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding: 6px 14px; background: #f3f6fa; }
  .who .name { font-size: 12px; font-weight: 600; color: #13254f; }
  .who .meta { color: #5b6678; font-size: 9.5px; margin-top: 1px; }
  .who .cut { text-align: right; font-size: 9.5px; color: #5b6678; }
  .who .cut b { display: block; color: #1b2433; font-size: 10.5px; font-weight: 600; }
  .body { padding: 2px 14px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1.5px 0; vertical-align: top; border: 0 !important; }
  td.n, td.sub { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  td.n { width: 86px; }
  td.sub { width: 74px; color: #5b6678; }
  tr.sec td { padding: 6px 0 2px; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; color: #13254f; border-bottom: 1px solid #d5dbe5 !important; }
  tr.l1 td:first-child { padding-left: 4px; }
  tr.l2 td:first-child { padding-left: 18px; color: #3f4a5c; }
  tr.grp td { padding-left: 4px; color: #5b6678; font-style: italic; }
  tr.tot td { font-weight: 700; border-top: 1px solid #1b2433 !important; padding-top: 3px; }
  .net { margin: 7px 14px 0; padding: 6px 12px; border-radius: 10px; background: #13254f; color: #fff; display: flex; justify-content: space-between; align-items: center; }
  .net span { font-size: 10px; letter-spacing: 0.14em; font-weight: 600; color: #cfe08f; }
  .net b { font-size: 15px; font-variant-numeric: tabular-nums; }
  .sign { display: grid; grid-template-columns: 1fr 1fr 1fr 0.75fr; gap: 10px; padding: 8px 14px 0; font-size: 9px; color: #5b6678; }
  .sign .line { border-top: 1px solid #1b2433; margin-top: 18px; padding-top: 2px; text-align: center; font-size: 9.5px; font-weight: 600; color: #1b2433; }
  .sign .role { text-align: center; }
  .foot { margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding: 7px 14px 8px; font-size: 9px; color: #5b6678; }
  .vac { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #eef5d6; color: #3f5410; font-weight: 600; font-size: 9.5px; }
`;

function slip(p: MyPayslip, vacationDays: number | undefined, copy: string) {
  const l = p.line;
  const pay = l.pay;
  const dm = pay?.deMinimis ?? 0;
  const nt = pay?.otherNonTaxable ?? 0;
  const items = p.items;
  const sumOf = (test: (label: string) => boolean) => -items.filter((i) => i.amount < 0 && test(i.label)).reduce((n, i) => n + i.amount, 0);
  const sssLoan = sumOf((t) => /^SSS/i.test(t));
  const pagibigLoan = sumOf((t) => /^Pag-?IBIG/i.test(t));
  const cashAdvance = sumOf((t) => /cash advance/i.test(t));
  const otherDeductions = sumOf((t) => !/^SSS|^Pag-?IBIG|cash advance/i.test(t));
  const otherBenefits = items.filter((i) => i.amount > 0).reduce((n, i) => n + i.amount, 0);
  const transport = pay?.transportAllowance ?? 0;
  const basic = l.basic - dm - nt;
  const gross = basic + dm + nt + l.premiums + l.overtime + transport + otherBenefits;
  const statutory = l.sssEe + sssLoan + l.piEe + pagibigLoan + l.phEe;
  const totalDeductions = l.deductions + statutory + l.tax + cashAdvance + otherDeductions;
  const s = admin.settings;
  const meta = [l.person.id, l.person.position, l.person.department].filter(Boolean).map((x) => escapeHtml(String(x))).join(" · ");
  const row = (label: string, amount: number) => `<tr class="l1"><td>${escapeHtml(label)}</td><td class="sub"></td><td class="n">${money(amount)}</td></tr>`;
  const group = (label: string) => `<tr class="grp"><td colspan="3">${escapeHtml(label)}</td></tr>`;
  const sub = (label: string, amount: number, total?: number) => `<tr class="l2"><td>${escapeHtml(label)}</td><td class="sub">${money(amount)}</td><td class="n">${total === undefined ? "" : money(total)}</td></tr>`;
  const total = (label: string, amount: number) => `<tr class="tot"><td colspan="2">${escapeHtml(label)}</td><td class="n">${money(amount)}</td></tr>`;
  const signer = (label: string, name: string | undefined, role: string) =>
    `<div><div>${label}</div><div class="line">${escapeHtml(name || "AUTHORIZED SIGNATORY")}</div><div class="role">${role}</div></div>`;

  return `<div class="slip">
    <div class="top">
      <img src="${window.location.origin}/brand/msma-logo.png" alt="MSMA">
      <div class="co"><b>${escapeHtml(s.companyName)}</b><span>${escapeHtml(s.address || "")}</span></div>
      <div class="tag"><b>PAYSLIP</b><span>${copy}</span></div>
    </div>
    <div class="who">
      <div><div class="name">${escapeHtml(l.person.name)}</div><div class="meta">${meta}</div></div>
      <div class="cut">Cut-off<b>${escapeHtml(long(p.period.from))} – ${escapeHtml(long(p.period.to))}, ${p.period.to.slice(0, 4)}</b></div>
    </div>
    <div class="body">
      <table>
        <tr class="sec"><td colspan="3">GROSS PAY</td></tr>
        ${row("Basic pay", basic)}
        ${row("De-minimis benefits", dm)}
        ${row("Other non taxable / Exempt compensation", nt)}
        ${row("Holiday and premium pay", l.premiums)}
        ${row("Overtime Pay and OT Meal Allowance", l.overtime)}
        ${group("Other benefits and bonuses")}
        ${sub("Transportation Allowance", transport, transport)}
        ${sub("Others", otherBenefits, otherBenefits)}
        ${total("Gross pay", gross)}
        <tr class="sec"><td colspan="3">DEDUCTIONS</td></tr>
        ${row("Absences, Lates and Undertime", l.deductions)}
        ${group("Statutory deductions")}
        ${sub("SSS Contribution", l.sssEe)}
        ${sub("SSS Loan", sssLoan)}
        ${sub("Pag-Ibig Contribution", l.piEe)}
        ${sub("Pag-Ibig Loan", pagibigLoan)}
        ${sub("Philhealth Contribution", l.phEe, statutory)}
        ${row("Withholding tax on compensation", l.tax)}
        ${group("Other deductions")}
        ${sub("Cash advance", cashAdvance, cashAdvance)}
        ${sub("Others", otherDeductions, otherDeductions)}
        ${total("Total deductions", totalDeductions)}
      </table>
    </div>
    <div class="net"><span>NET PAY</span><b>₱ ${money(l.net)}</b></div>
    <div class="sign">
      ${signer("Prepared by:", p.preparedBy, "Payroll Officer")}
      ${signer("Approved by:", p.approvedBy, "Approving Officer")}
      <div><div>Received by:</div><div class="line">${escapeHtml(l.person.name)}</div><div class="role">Signature over printed name</div></div>
      <div><div>Date received:</div><div class="line">&nbsp;</div></div>
    </div>
    <div class="foot">
      ${vacationDays !== undefined ? `<span class="vac">No. of vacation days = ${escapeHtml(String(vacationDays))}</span>` : "<span></span>"}
      <span>Printed ${escapeHtml(new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }))}</span>
    </div>
  </div>`;
}

/** Opens the print dialog with the workbook-style payslip: employee's copy and company's copy. */
export function printWorkbookPayslip(p: MyPayslip, vacationDays?: number) {
  openPrintDocument(
    `Payslip ${p.period.label} · ${p.line.person.name}`,
    `<style>${STYLES}</style><div class="sheet">${slip(p, vacationDays, "Employee's copy")}${slip(p, vacationDays, "Company's copy")}</div>`,
  );
}
