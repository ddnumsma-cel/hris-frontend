// Government contributions mock API: the dated SSS, PhilHealth and Pag-IBIG rates
// payroll and reports use. Each call stands in for an HTTP request.

import { logAdmin } from "./admin/store";
import { remoteApi, remoteOn } from "./remote";
import { addVersion, refreshRates, removeVersion, versionsOf, type Agency, type AgencyRates, type RateVersion } from "./reports/statutory";
import { AGENCIES, rateProblem } from "./pay/rateRules";
import { deny } from "./session";

export { AGENCIES, RATE_FIELDS, type FieldKind, type RateField } from "./pay/rateRules";

const DELAY = 200;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

export async function listVersions<A extends Agency>(agency: A): Promise<RateVersion<A>[]> {
  const denied = deny("contributions", "view");
  if (denied) return denied;
  if (remoteOn()) await refreshRates();
  return respond(versionsOf(agency));
}

const label = (a: Agency) => AGENCIES.find((x) => x.id === a)!.label;

export async function saveVersion<A extends Agency>(agency: A, input: { effectiveFrom: string; source: string; rates: AgencyRates[A] }, actor: string): Promise<RateVersion<A>> {
  const denied = deny("contributions", "create");
  if (denied) return denied;
  if (remoteOn()) await refreshRates();
  const problem = rateProblem(agency, input, versionsOf(agency), new Date().toISOString().slice(0, 10));
  if (problem) return fail(problem);
  if (remoteOn()) {
    const v = await remoteApi<RateVersion<A>>("POST", `/payroll/rates/${agency}`, { ...input, source: input.source.trim() });
    await refreshRates();
    return v;
  }
  const v = addVersion(agency, input, actor);
  logAdmin({ actor, module: "Payroll", action: `Saved ${label(agency)} rates`, target: label(agency), detail: `Effective ${input.effectiveFrom} · ${input.source.trim()}` });
  return respond(v);
}

export async function deleteVersion(agency: Agency, id: string, actor: string): Promise<void> {
  const denied = deny("contributions", "delete");
  if (denied) return denied;
  if (remoteOn()) {
    await remoteApi("DELETE", `/payroll/rates/${agency}/${encodeURIComponent(id)}`);
    return refreshRates();
  }
  const v = versionsOf(agency).find((x) => x.id === id);
  if (!v) return fail("That version no longer exists");
  if (!removeVersion(agency, id)) return fail("Rates already in force stay on record and can't be removed");
  logAdmin({ actor, module: "Payroll", action: `Removed upcoming ${label(agency)} rates`, target: label(agency), detail: `Effective ${v.effectiveFrom} · ${v.source}` });
  return respond(undefined);
}
