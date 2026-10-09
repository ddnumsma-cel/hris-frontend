// Alerts for a manager about their own team, shown in the notifications bell next to announcements.
// Today: who switched to working from home (no approval needed, so the manager is told instead).

import { fullName, state as core } from "./corehr/store";
import { fmtTime } from "./preferences";
import { sessionWho } from "./session";
import { tk, todayIso } from "./timekeeping/store";

export interface TeamNotice {
  id: string;
  title: string;
  /** Shown under the title, where announcements show their date. */
  postedOn: string;
}

export function teamNotices(): Promise<TeamNotice[]> {
  const team = new Set(sessionWho().team);
  const date = todayIso();
  const notices = (tk.wfh ?? [])
    .filter((w) => w.date === date && team.has(w.employeeId))
    .map((w) => {
      const e = core.employees.find((x) => x.id === w.employeeId);
      const name = e ? fullName(e.personal) : w.employeeId;
      const punches = (tk.remotePunches ?? []).filter((p) => p.employeeId === w.employeeId && p.workDate === date && !tk.voided[p.id]);
      const inAt = punches.find((p) => p.kind === "in");
      const where = inAt?.location && "lat" in inAt.location ? " · location saved" : "";
      return {
        id: `wfh-${w.id}`,
        title: `${name} is working from home today`,
        postedOn: inAt ? `Clocked in ${fmtTime(inAt.at)} with a face scan${where}` : "Hasn't clocked in yet",
      };
    });
  return Promise.resolve(notices);
}
