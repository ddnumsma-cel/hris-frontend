import { escapeHtml, openPrintDocument } from "@/lib/printDocument";
import { formatPHP } from "@/lib/format";
import type { CertificateRequest, Employee, Payslip } from "@/lib/types";

const generatedOn = () =>
  new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

export function printPayslip(employee: Employee | undefined, payslip: Payslip) {
  const rows = payslip.breakdown
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.label)}</td><td class="num">${line.kind === "deduction" ? "−" : ""}${formatPHP(line.amount)}</td></tr>`,
    )
    .join("");

  const body = `
    <div class="doc-header">
      <div class="doc-brand">MSMA</div>
      <div class="doc-title">
        <h1>Payslip</h1>
        <p>${escapeHtml(payslip.cutoffLabel)}</p>
      </div>
    </div>
    <div class="meta-grid">
      <div><span class="meta-label">Employee</span><span class="meta-value">${escapeHtml(employee?.name ?? "")}</span></div>
      <div><span class="meta-label">Employee ID</span><span class="meta-value">${escapeHtml(employee?.id ?? "")}</span></div>
      <div><span class="meta-label">Position</span><span class="meta-value">${escapeHtml(employee?.position ?? "")}</span></div>
      <div><span class="meta-label">Status</span><span class="meta-value">${escapeHtml(payslip.status)}</span></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row"><td>Net pay</td><td class="num">${formatPHP(payslip.net)}</td></tr>
      </tbody>
    </table>
    <p class="doc-footer">Generated from MSMA HRIS on ${generatedOn()}. This is a system-generated payslip for reference — official copies are issued by HR/Payroll.</p>
  `;

  openPrintDocument(`Payslip ${payslip.id}`, body);
}

export function print201File(employee: Employee) {
  const rows: [string, string][] = [
    ["Employee ID", employee.id],
    ["Position", employee.position],
    ["Department", employee.department],
    ["Cluster", employee.cluster],
    ["Office", employee.office],
    ["Status", employee.status],
    ["Email", employee.email ?? "—"],
    ["Phone", employee.phone ?? "—"],
    ["Emergency contact", employee.emergencyContact ?? "—"],
  ];
  const rowsHtml = rows
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join("");

  const body = `
    <div class="doc-header">
      <div class="doc-brand">MSMA</div>
      <div class="doc-title">
        <h1>201 File Summary</h1>
        <p>${escapeHtml(employee.name)}</p>
      </div>
    </div>
    <table>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p class="doc-footer">Generated from MSMA HRIS on ${generatedOn()}.</p>
  `;

  openPrintDocument(`201 File - ${employee.name}`, body);
}

export function printCertificate(employee: Employee, request: CertificateRequest) {
  const bodyText =
    request.type === "Certificate of Employment"
      ? `This is to certify that <strong>${escapeHtml(employee.name)}</strong> (Employee ID ${escapeHtml(employee.id)}) is an employee of MSMA Group in ${escapeHtml(employee.status).toLowerCase()} status, holding the position of <strong>${escapeHtml(employee.position)}</strong> under the ${escapeHtml(employee.department)} department, ${escapeHtml(employee.cluster)}, ${escapeHtml(employee.office)} office.`
      : request.type === "Certificate of Tax Withheld (2316)"
        ? `This certifies that BIR Form 2316 for <strong>${escapeHtml(employee.name)}</strong> (Employee ID ${escapeHtml(employee.id)}) has been prepared and released by MSMA Group for the applicable taxable year.`
        : `This is to certify that <strong>${escapeHtml(employee.name)}</strong> (Employee ID ${escapeHtml(employee.id)}) is employed with MSMA Group as <strong>${escapeHtml(employee.position)}</strong>, ${escapeHtml(employee.department)} department.`;

  const body = `
    <div class="doc-header">
      <div class="doc-brand">MSMA</div>
      <div class="doc-title">
        <h1>${escapeHtml(request.type)}</h1>
        <p>Requested ${escapeHtml(request.requestedOn)}</p>
      </div>
    </div>
    <p class="cert-body">${bodyText}</p>
    <p class="cert-body">Purpose: ${escapeHtml(request.purpose)}</p>
    <p class="doc-footer">Generated from MSMA HRIS on ${generatedOn()}. This is a system-generated copy for reference — signed originals are released by HR.</p>
  `;

  openPrintDocument(request.type, body);
}
