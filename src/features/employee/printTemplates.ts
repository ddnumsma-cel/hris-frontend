import { escapeHtml, openPrintDocument } from "@/lib/printDocument";
import { certificateStatement } from "@/lib/certificates";
import type { CertificateRequest, Employee } from "@/lib/types";

const generatedOn = () =>
  new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

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

/** Prints the filed copy when the certificate was issued (the same document HR keeps), otherwise one made from the record. */
export function printCertificate(employee: Employee, request: CertificateRequest) {
  const filed = request.issued;
  const bodyText = filed?.statement ?? certificateStatement(employee, request.type);
  const issuedOn = filed ? new Date(filed.issuedAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "";
  const body = `
    <div class="doc-header">
      <div class="doc-brand">MSMA</div>
      <div class="doc-title">
        <h1>${escapeHtml(request.type)}</h1>
        <p>${filed ? `No. ${escapeHtml(filed.number)} · Issued ${escapeHtml(issuedOn)}` : `Requested ${escapeHtml(request.requestedOn)}`}</p>
      </div>
    </div>
    <p class="cert-body">${bodyText}</p>
    <p class="cert-body">Purpose: ${escapeHtml(filed?.purpose ?? request.purpose)}</p>
    <p class="doc-footer">${filed ? `Issued by ${escapeHtml(filed.issuedBy)} through MSMA HRIS. A copy is kept on file with HR under No. ${escapeHtml(filed.number)}.` : `Generated from MSMA HRIS on ${generatedOn()}. This is a system-generated copy for reference — signed originals are released by HR.`}</p>
  `;

  openPrintDocument(request.type, body);
}
