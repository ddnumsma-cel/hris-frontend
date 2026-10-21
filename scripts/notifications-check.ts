// Bell notifications for requests, decisions and changes, signed in as each demo account.
// Run: npm run check:notifications   (starts from fresh demo data each time)

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
const notes = await import("../src/lib/notifications");
const leaveApi = await import("../src/lib/leave/api");
const leaveStore = await import("../src/lib/leave/store");
const claimsApi = await import("../src/lib/reimbursements/api");
const tkApi = await import("../src/lib/timekeeping/api");
const core = await import("../src/lib/corehr/api");
const coreStore = await import("../src/lib/corehr/store");
const as = (id: string) => store.set("msma-hris-account", id);
const bell = async (id: string) => { as(id); return (await notes.listMyNotifications()).map((n) => `[${n.kind}] ${n.title} — ${n.body}${n.link ? `  → ${n.link}` : ""}`); };
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => { if (!ok) failed++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(extra)); };
const typeId = leaveStore.leave.types.find((t) => t.earning.kind !== "unlimited")!.id;
const nextWeekday = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

console.log("\n— Leave: Super Admin files for Bea (team of Rafael) —");
as("ua-super");
const day = nextWeekday(10);
const lr = await leaveApi.fileLeave({ employeeId: "MSMA-00560", typeId, start: day, end: day, reason: "Family event" } as never, "System Administrator");
const raf = await bell("ua-approver");
console.log(raf.slice(0, 2));
check("Rafael (Bea's manager) gets 'Katrina Enriquez filed …' as a request with a link to Approvals", raf.some((x) => x.startsWith("[request] Katrina Enriquez filed") && x.includes("/manager/approvals?tab=leave")), raf);
check("Super Admin isn't told about their own filing", !(await bell("ua-super")).some((x) => x.includes("Katrina Enriquez filed")));
check("Antonio (not her manager) gets nothing", !(await bell("ua-partner-sanchez")).some((x) => x.includes("Katrina Enriquez filed")));
as("ua-approver");
await leaveApi.decideRequest(lr.id, true, "", "Lorraine Santos");
check("Rafael isn't told about his own decision", !(await bell("ua-approver")).some((x) => x.includes("was approved")));

console.log("\n— Claims: the demo employee (Chris) files, Super Admin endorses, Accounting approves —");
as("ua-employee");
const c = await claimsApi.fileClaim({ employeeId: "MSMA-00846", category: "Meals", merchant: "Jollibee", purchaseDate: new Date().toISOString().slice(0, 10), amount: 350, description: "Client lunch", receipt: "data:image/jpeg;base64,AAAA" } as never).catch((e: Error) => { console.log("file failed:", e.message); return null; });
if (c) {
  const angelaManager = (await import("../src/lib/outbox")).managerOf("MSMA-00846");
  check(`Claim request goes to Chris's manager (${angelaManager}), not to Angela`, !(await bell("ua-employee")).some((x) => x.includes("filed a Meals claim")));
  as("ua-super");
  await claimsApi.decideClaim(c.id, true, "", "System Administrator");
  const acc = await bell("ua-accounting");
  console.log(acc.slice(0, 1));
  check("Accounting gets 'ready for final approval'", acc.some((x) => x.startsWith("[request]") && x.includes("ready for final approval")), acc);
  check("Chris is told it was endorsed", (await bell("ua-employee")).some((x) => x.includes("was endorsed")));
  as("ua-accounting");
  await claimsApi.decideClaim(c.id, true, "", "Accounting");
  const ang = await bell("ua-employee");
  console.log(ang.slice(0, 2));
  check("Chris is told it was approved, linked to her reimbursements", ang.some((x) => x.startsWith("[approved] Your Meals claim") && x.includes("/employee/reimbursements")), ang);
}

console.log("\n— Overtime: Chris files, Super Admin declines —");
as("ua-employee");
const ot = await tkApi.fileRequest({ employeeId: "MSMA-00846", date: new Date().toISOString().slice(0, 10), type: "overtime", minutes: 90, reason: "Month-end close" }, "Angela");
as("ua-super");
await tkApi.decideRequest(ot.id, false, "Not pre-approved", "System Administrator");
const ang2 = await bell("ua-employee");
check("Chris is told her overtime was declined, with the reason", ang2.some((x) => x.startsWith("[rejected] Your overtime was declined") && x.includes("Not pre-approved")), ang2);

console.log("\n— 201 documents: HR returns one of Chris's —");
as("ua-hr");
const doc = coreStore.state.documents.find((d) => d.employeeId === "MSMA-00846" && d.status === "Submitted") ?? coreStore.state.documents.find((d) => d.employeeId === "MSMA-00846")!;
await core.updateDocument(doc.id, { kind: "return", note: "Photo is blurry" } as never, "Wendy Lacson");
check("Chris is told it was sent back, with the note", (await bell("ua-employee")).some((x) => x.includes("was sent back") && x.includes("Photo is blurry")));

console.log("\n— Org chart: HR moves Chris under Rafael —");
as("ua-hr");
await core.setReportsTo("MSMA-00846", "MSMA-00317", "Wendy Lacson");
check("Rafael is told Chris now reports to him", (await bell("ua-approver")).some((x) => x.includes("now reports to you")));
check("Chris is told she reports to Rafael", (await bell("ua-employee")).some((x) => x.includes("You now report to Lorraine Santos")));
as("ua-employee");
await tkApi.fileRequest({ employeeId: "MSMA-00846", date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), type: "undertime", minutes: 60, reason: "Doctor" }, "Angela");
check("Her next request now goes to Rafael", (await bell("ua-approver")).some((x) => x.includes("Danica Bernardo filed undertime")));

console.log("\n— Assigned roles: the matrix decides who handles each next step —");
const approvers = await import("../src/lib/admin/approvers");
check("Final approval of claims → Accounting (not Super Admin)", JSON.stringify(approvers.rolesThatCan("final", "claims")) === JSON.stringify(["accounting"]), approvers.rolesThatCan("final", "claims"));
check("Checking 201 documents → HR", JSON.stringify(approvers.rolesThatCan("edit", "documents")) === JSON.stringify(["hr"]), approvers.rolesThatCan("edit", "documents"));

console.log("\n— Workflows: leave goes to whoever Administration › Workflows assigns —");
const adminApi = await import("../src/lib/admin/api");
const adminStore = await import("../src/lib/admin/store");
const hrRole = adminStore.admin.roles.find((r) => r.key === "hr")!.id;
const superRole = adminStore.admin.roles.find((r) => r.key === "super_admin")!.id;
as("ua-super");
await adminApi.saveWorkflow({ kind: "leave", steps: [{ approver: "role", roleId: hrRole }], remindAfterDays: 2, active: true } as never, "System Administrator");
const day2 = nextWeekday(20);
await leaveApi.fileLeave({ employeeId: "MSMA-00560", typeId, start: day2, end: day2, reason: "Errand" } as never, "System Administrator");
check("Leave workflow set to HR: Dinah (HR) gets Bea's request", (await bell("ua-hr")).some((x) => x.includes("Katrina Enriquez filed") && x.includes("Errand") && x.includes("/admin/maintenance/leave/requests")));
check("…and Rafael (her supervisor) doesn't", !(await bell("ua-approver")).some((x) => x.includes("Errand")));
as("ua-super");
await adminApi.saveWorkflow({ kind: "leave", steps: [{ approver: "supervisor" }, { approver: "role", roleId: superRole, overDays: 3 }], remindAfterDays: 2, active: true } as never, "System Administrator");
as("ua-employee");
const freeType = leaveStore.leave.types.find((t) => t.earning.kind === "unlimited")?.id ?? typeId;
const long1 = nextWeekday(40);
let lastDay = long1;
// 6 workdays, so the leave stays over the 3-day step even when one or two holidays fall inside it.
for (let n = 1; n < 6; ) { const x = new Date(lastDay); x.setDate(x.getDate() + 1); lastDay = x.toISOString().slice(0, 10); if (![0, 6].includes(x.getDay())) n++; }
await leaveApi.fileLeave({ employeeId: "MSMA-00846", typeId: freeType, start: long1, end: lastDay, reason: "Long trip" } as never, "Angela").catch((e: Error) => console.log("long leave:", e.message));
const rafLong = (await bell("ua-approver")).some((x) => x.includes("Long trip"));
const superLong = (await bell("ua-super")).some((x) => x.includes("Long trip"));
check("Long leave with an extra Super Admin step: both Rafael and Super Admin are told", rafLong && superLong, { rafLong, superLong });

console.log("\n— Certificates: employee asks, HR prepares it, employee is told —");
const legacy = await import("../src/lib/api");
as("ua-employee");
const cert = await legacy.createCertificateRequest({ type: "Certificate of Employment", purpose: "Visa application" });
check("HR gets the request, linked to Requests › Certificates", (await bell("ua-hr")).some((x) => x.startsWith("[request]") && x.includes("requested a Certificate of Employment") && x.includes("/admin/requests/certificates")));
as("ua-hr");
await legacy.issueCertificate(cert.id, "Wendy Lacson");
check("HR issues it: the employee is told it's ready to download, linked to their certificates", (await bell("ua-employee")).some((x) => x.startsWith("[approved]") && x.includes("is ready") && x.includes("Download or print") && x.includes("/employee/certificates")));
as("ua-hr");
check("…and it's released as a digital copy", (await legacy.fetchCertificateRequestsForReview()).some((r) => r.id === cert.id && r.status === "Released" && r.delivery === "digital"));
as("ua-hr");
const filed = (await legacy.fetchCertificateRequestsForReview()).find((r) => r.id === cert.id)!;
check(`HR keeps a copy: filed as ${filed.issued?.number}, with the exact wording, purpose, who and when`, /^COE-\d{4}-\d{4}$/.test(filed.issued?.number ?? "") && !!filed.issued?.statement.includes("Danica Bernardo") && filed.issued?.purpose === "Visa application" && filed.issued?.issuedBy === "Wendy Lacson");
const mock = await import("../src/lib/mockData");
mock.setEmployeeDirectory(mock.employeeDirectory.map((e) => (e.id === "MSMA-00846" ? { ...e, position: "Senior Associate" } : e)));
const later = (await legacy.fetchCertificateRequestsForReview()).find((r) => r.id === cert.id)!;
check("The filed copy doesn't change when her record does (still Associate 1)", !!later.issued?.statement.includes("Associate 1") && !later.issued?.statement.includes("Senior Associate"));
as("ua-employee");
const cert2 = await legacy.createCertificateRequest({ type: "Certificate of Tax Withheld (2316)", purpose: "Loan" });
as("ua-hr");
await legacy.declineCertificate(cert2.id, "Your 2316 isn't filed yet", "Wendy Lacson");
check("HR declines one: the employee is told why", (await bell("ua-employee")).some((x) => x.startsWith("[rejected]") && x.includes("declined") && x.includes("isn't filed yet")));

console.log("\n— Support: an employee reports a problem straight to IT —");
const support = await import("../src/lib/support/store");
as("ua-employee");
const tk = await support.fileTicket({ subject: "Clock-in button does nothing", category: "Bug or error", priority: "normal", text: "I tap Clock in and nothing happens." });
check("System Admin gets the ticket, linked to Support tickets", (await bell("ua-sysadmin")).some((x) => x.startsWith("[request]") && x.includes(`#${tk.number}`) && x.includes("/admin/administration/support")));
check("HR isn't told and can't see it", !(await bell("ua-hr")).some((x) => x.includes(`#${tk.number}`)) && (as("ua-hr"), !(await support.listTickets()).some((t) => t.id === tk.id)));
as("ua-employee");
check("The employee sees only their own tickets", (await support.listTickets()).every((t) => t.filedById === "ua-employee"));
as("ua-sysadmin");
await support.replyTicket(tk.id, "Fixed, please try again.");
check("The employee is told support replied, linked to their Support page", (await bell("ua-employee")).some((x) => x.includes(`Support replied to ticket #${tk.number}`) && x.includes("/employee/support")));

console.log(failed ? `\n${failed} failed` : "\nAll notification checks passed");
