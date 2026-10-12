// Subscription & seat limit checks against the mock API, signed in as each demo account.
// Run: npm run check:subscription   (starts from fresh demo data each time)

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

const ACCOUNTS = { sysadmin: "ua-sysadmin", superadmin: "ua-super", admin1: "ua-hr", "antonio.sanchez": "ua-partner-sanchez", accounting: "ua-accounting", admin2: "ua-employee" } as const;
type Login = keyof typeof ACCOUNTS;
const signIn = (who: Login) => store.set("msma-hris-account", ACCOUNTS[who]);

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : detail);
};
/** Resolves to the error (or null when the call succeeded). */
const errorOf = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as Error & { status?: number; code?: string });

const sub = await import("../src/lib/subscription/api");
const subStore = await import("../src/lib/subscription/store");
const core = await import("../src/lib/corehr/api");
const coreStore = await import("../src/lib/corehr/store");
const legacy = await import("../src/lib/api");
const adminApi = await import("../src/lib/admin/api");
const adminStore = await import("../src/lib/admin/store");
const notes = await import("../src/lib/notifications");
const runs = await import("../src/lib/pay/runs");
const tk = await import("../src/lib/timekeeping/api");

// Room in every position, so only the seat limit can refuse an add in these checks.
coreStore.commit({ ...coreStore.state, positions: coreStore.state.positions.map((p) => ({ ...p, slots: 999, active: true })) });
const position = coreStore.state.positions[0]!;
let n = 0;
const newHire = () => {
  n++;
  return {
    personal: { firstName: "Test", middleName: "", lastName: `Hire ${n}`, suffix: "", birthDate: "1995-01-01", sex: "" as const, civilStatus: "" as const, nationality: "Filipino" },
    contact: { workEmail: `test.hire${n}@msma.ph`, personalEmail: `hire${n}@mail.com`, mobile: "09171234567", address: "1 Test St", city: "Cebu City", province: "Cebu", emergencyName: "Kin", emergencyRelationship: "Parent", emergencyPhone: "09171234568" },
    government: { sss: "1234567890", philhealth: "", pagibig: "", tin: "" },
    job: { cluster: "RPM", positionId: position.id, teamId: "", supervisorId: "", employmentType: "Regular" as const, dateHired: "2026-10-01", monthlySalary: 25000, workSchedule: "Mon–Fri", shiftId: "" },
  };
};
const notificationsFor = async (who: Login) => {
  signIn(who);
  return notes.listMyNotifications();
};
const count = async (who: Login, text: string) => (await notificationsFor(who)).filter((x) => x.title.includes(text)).length;

console.log("\n— Seeded demo plan —");
signIn("superadmin");
let u = await sub.getSubscription();
check(`Starter plan on the demo client: ${u.planName}, ${u.seatsUsed}/${u.seatLimit} seats, ${u.adminsUsed}/${u.adminLimit} admin accounts`, u.planName === "Starter" && u.seatLimit === 20 && u.adminLimit === 8);
check(`Seats are counted from active records (${u.seatsUsed} = non-separated employees)`, u.seatsUsed === coreStore.state.employees.filter((e) => e.job.status !== "Separated").length);
check("Grace: 5% of 20 rounds down to 1 → cap 21", u.seatCap === 21);
check(`At ${u.seatsUsed}/20 the status is "near" (80% banner shows)`, u.status === "near");
check("80%: Super Admin and HR told seats are almost full", (await count("superadmin", "almost full")) === 1 && (await count("admin1", "almost full")) === 1);
check("80% alert says how many are left in plain words", (await notificationsFor("admin1")).some((x) => x.title.includes("almost full") && x.body.includes(`so ${20 - u.seatsUsed} seats are left`)));
check("80% sends nothing to System Admin", (await count("sysadmin", "seat")) === 0);
check("80% crossing is logged once", subStore.sub.events.filter((e) => e.kind === "threshold").length === 1);

console.log("\n— Who can see and call subscription features —");
for (const who of ["superadmin", "admin1"] as Login[]) {
  signIn(who);
  check(`${who}: getSubscription allowed`, (await errorOf(sub.getSubscription())) === null);
  check(`${who}: listClients refused (403)`, (await errorOf(sub.listClients()))?.status === 403);
}
signIn("admin1");
check("admin1 (HR): requestUpgrade refused (403)", (await errorOf(sub.requestUpgrade("", "Dinah")))?.status === 403);
for (const who of ["antonio.sanchez", "accounting", "admin2"] as Login[]) {
  signIn(who);
  const calls = [sub.getSubscription(), sub.requestUpgrade("", who), sub.listClients(), sub.listPlans(), sub.listSubscriptionEvents(), sub.changePlan(subStore.DEMO_CLIENT_ID, "plan-growth", who), sub.setSeatOverride(subStore.DEMO_CLIENT_ID, 99, who), sub.grantExtension(subStore.DEMO_CLIENT_ID, { seats: 5, until: "2099-01-01" }, who)];
  const statuses = await Promise.all(calls.map(async (c) => (await errorOf(c))?.status));
  check(`${who}: every subscription endpoint refused (403)`, statuses.every((s) => s === 403), JSON.stringify(statuses));
}
signIn("sysadmin");
check("sysadmin: listClients allowed", (await errorOf(sub.listClients())) === null);

console.log("\n— Upgrade request —");
signIn("superadmin");
check("superadmin: requestUpgrade allowed", (await errorOf(sub.requestUpgrade("Hiring 10 next month", "System Administrator"))) === null);
check("System Admin gets the upgrade request", (await count("sysadmin", "requested an upgrade")) === 1);

console.log("\n— Adding employees up to and past the limit (signed in as admin1, HR) —");
signIn("admin1");
const before = u.seatsUsed;
let added = 0;
while (before + added < 18) {
  await core.createEmployee(newHire(), "Dinah");
  added++;
}
signIn("admin1");
u = await sub.getSubscription();
check(`At ${u.seatsUsed}/20 (90%): Super Admin and HR notified`, (await count("superadmin", "Only 2 seats left")) === 1 && (await count("admin1", "Only 2 seats left")) === 1);
check("At 90%: System Admin notified", (await count("sysadmin", "90% of its seats")) === 1);
signIn("admin1");
for (let i = 0; i < 3; i++) await sub.getSubscription();
check("Reloading doesn't resend the 90% alert", (await count("admin1", "Only 2 seats left")) === 1 && (await count("sysadmin", "90% of its seats")) === 1);

signIn("admin1");
const bigImport = await errorOf(core.importEmployees(Array.from({ length: 30 }, newHire), "Dinah"));
check(`Bulk import is checked first: "${bigImport?.message}"`, bigImport?.code === "SEAT_LIMIT_REACHED" && bigImport.message === "This import has 30 employees but only 3 seats are available.");
check("…and nobody from that import was added", (await sub.getSubscription()).seatsUsed === 18);

signIn("admin1");
await core.createEmployee(newHire(), "Dinah");
await core.createEmployee(newHire(), "Dinah");
u = await sub.getSubscription();
check(`At ${u.seatsUsed}/20 (100%): System Admin told the client, plan and usage`, (await notificationsFor("sysadmin")).some((x) => x.title.includes("at its seat limit") && x.body.includes("Starter") && x.body.includes("20 of 20")));
check("At 100%: Super Admin and HR told all seats are used", (await count("superadmin", "All employee seats are used")) === 1 && (await count("admin1", "All employee seats are used")) === 1);
signIn("admin1");
check("21st employee fits in the 5% grace", (await errorOf(core.createEmployee(newHire(), "Dinah"))) === null);
u = await sub.getSubscription();
check(`Status at ${u.seatsUsed}/20 is "In grace"`, u.status === "grace");
signIn("admin1");
const blocked = await errorOf(core.createEmployee(newHire(), "Dinah"));
check(`22nd employee refused with SEAT_LIMIT_REACHED: "${blocked?.message}"`, blocked?.code === "SEAT_LIMIT_REACHED" && blocked.status === 409);
check("Blocked add tells System Admin (with client, plan and usage)", (await notificationsFor("sysadmin")).some((x) => x.title.includes("add employee blocked") && x.body.includes("tried to add an employee") && x.body.includes("Starter") && x.body.includes("21 of 20")));
signIn("admin1");
check("Older Add employee dialog refused too", (await errorOf(legacy.createEmployee({ firstName: "Old", lastName: "Path", position: "Junior Associate", department: "Tax Advisory", office: "Cebu HQ", cluster: "RPM" } as never)))?.code === "SEAT_LIMIT_REACHED");
check("Self-registration refused too", (await errorOf(legacy.registerEmployee({ name: "Self Reg", position: "Junior Associate", office: "Cebu HQ", cluster: "RPM" } as never)))?.code === "SEAT_LIMIT_REACHED");
check("Blocked attempts are logged", subStore.sub.events.filter((e) => e.kind === "blocked").length === 4);

console.log("\n— Nothing else is blocked over the limit —");
signIn("accounting");
check("Accounting can still open payroll runs", (await errorOf(runs.listRuns())) === null);
signIn("admin1");
check("HR can still open attendance", (await errorOf(tk.listDays("2026-10-01", "2026-10-15"))) === null);
check("HR can still edit an employee", (await errorOf(core.updateEmployeeSection(coreStore.state.employees[0]!.id, "personal", { ...coreStore.state.employees[0]!.personal, nationality: "Filipino" }, "Dinah"))) === null);

console.log("\n— Separation frees a seat; reactivating takes one —");
signIn("admin1");
const leaver = coreStore.state.employees.find((e) => e.contact.workEmail === "test.hire1@msma.ph")!;
await core.recordSeparation(leaver.id, { lastDay: "2026-10-02", reason: "Resigned", note: "" }, "Dinah");
u = await sub.getSubscription();
check(`Separated employee no longer counts (${u.seatsUsed}/20)`, u.seatsUsed === 20);
await core.createEmployee(newHire(), "Dinah");
const reactivate = await errorOf(core.cancelSeparation(leaver.id, "Dinah"));
check("Reactivating at the cap is refused", reactivate?.code === "SEAT_LIMIT_REACHED");

console.log("\n— System Admin actions —");
signIn("sysadmin");
await sub.grantExtension(subStore.DEMO_CLIENT_ID, { seats: 5, until: "2099-12-31" }, "System Admin");
signIn("admin1");
u = await sub.getSubscription();
check(`Extension +5 → limit ${u.seatLimit}, cap ${u.seatCap}`, u.seatLimit === 25 && u.seatCap === 26);
check("Reactivation now allowed", (await errorOf(core.cancelSeparation(leaver.id, "Dinah"))) === null);
signIn("sysadmin");
await sub.setSeatOverride(subStore.DEMO_CLIENT_ID, 40, "System Admin");
await sub.grantExtension(subStore.DEMO_CLIENT_ID, null, "System Admin");
signIn("admin1");
u = await sub.getSubscription();
check(`Seat override 40 → ${u.seatsUsed}/${u.seatLimit}, status ${u.status}`, u.seatLimit === 40 && u.status === "ok");
signIn("sysadmin");
await sub.setSeatOverride(subStore.DEMO_CLIENT_ID, null, "System Admin");
await sub.changePlan(subStore.DEMO_CLIENT_ID, "plan-growth", "System Admin");
signIn("admin1");
u = await sub.getSubscription();
check(`Change plan to Growth → ${u.planName} ${u.seatLimit} seats`, u.planName === "Growth" && u.seatLimit === 50);
signIn("sysadmin");
const log = await sub.listSubscriptionEvents();
check(`Event log has ${log.length} entries incl. upgrade request, blocks, plan change`, ["upgrade-request", "blocked", "plan-changed", "seat-override", "extension", "threshold"].every((k) => log.some((e) => e.kind === k)));
signIn("sysadmin");
await sub.changePlan(subStore.DEMO_CLIENT_ID, "plan-starter", "System Admin");

console.log("\n— Admin account limit (8 + 5% grace rounded down = 8) —");
signIn("superadmin");
const hrRole = adminStore.admin.roles.find((r) => r.key === "hr")!;
for (let i = 0; i < 2; i++) await adminApi.createAccount({ name: `HR ${i}`, username: `hr.test${i}`, roleId: hrRole.id }, "Super");
signIn("superadmin");
check(`Admin accounts at ${(await sub.getSubscription()).adminsUsed}/8`, (await sub.getSubscription()).adminsUsed === 8);
const adminBlocked = await errorOf(adminApi.createAccount({ name: "HR 3", username: "hr.test3", roleId: hrRole.id }, "Super"));
check(`9th admin account refused with ADMIN_LIMIT_REACHED`, adminBlocked?.code === "ADMIN_LIMIT_REACHED", String(adminBlocked?.message));
const empRole = adminStore.admin.roles.find((r) => r.key === "employee")!;
check("Employee logins aren't limited", (await errorOf(adminApi.createAccount({ name: "Emp", username: "emp.test", roleId: empRole.id }, "Super"))) === null);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
