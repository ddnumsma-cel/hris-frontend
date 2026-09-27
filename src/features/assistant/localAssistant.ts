import { formatPHP } from "@/lib/format";
import type { AssistantData } from "./useAssistantData";

/**
 * A scripted, keyword-matched responder — not a real language model. It only
 * ever states facts already present in the app's own (mock) data, so answers
 * are always accurate to what's on screen, at the cost of only handling
 * questions it has a rule for.
 */
export function answerLocally(question: string, ctx: AssistantData): string {
  const q = question.toLowerCase();
  const first = (ctx.userName ?? "").split(" ")[0];

  if (/\b(hi|hello|hey)\b/.test(q) && q.length < 20) {
    return `Hi ${first}! Ask me about your leave balance, payslips, attendance${
      ctx.role === "manager" ? ", your team, or pending approvals" : ""
    }${ctx.role === "admin" ? ", company stats, or compliance filings" : ""}.`;
  }

  if (/\bwhat can you do\b|\bhelp\b/.test(q)) {
    const topics =
      ctx.role === "employee"
        ? "leave balances, your latest payslip, and your attendance rate"
        : ctx.role === "manager"
          ? "pending approvals, your team roster, and workforce alerts"
          : "company headcount, payroll, and compliance filings";
    return `I can answer questions about ${topics} — all pulled from real data already in this system. I'm a rule-based assistant, not a general AI, so I'll only understand questions about those topics.`;
  }

  // ---- Employee ----
  if (ctx.role === "employee") {
    if (/\b(vacation|sick|emergency|bereavement)\b.*\b(left|balance|remaining|have)\b|\bleave balance\b/.test(q)) {
      const type = /vacation/.test(q)
        ? "Vacation"
        : /sick/.test(q)
          ? "Sick"
          : /emergency/.test(q)
            ? "Emergency"
            : /bereavement/.test(q)
              ? "Bereavement"
              : null;
      if (!ctx.balances) return "I don't have your leave balances loaded yet — try again in a moment.";
      const rows = type ? ctx.balances.filter((b) => b.type === type) : ctx.balances;
      return rows
        .map((b) => `${b.type}: ${b.entitlement - b.used} of ${b.entitlement} days left (${b.used} used YTD)`)
        .join("\n");
    }
    if (/\bpayslip|net pay|salary|how much.*(paid|earn)\b/.test(q)) {
      const p = ctx.latestPayslip;
      if (!p) return "I don't have a payslip on file yet.";
      return `Your latest payslip (${p.cutoffLabel}): net pay ${formatPHP(p.net)}, gross ${formatPHP(p.gross)}, status ${p.status}.`;
    }
    if (/\battendance|on.?time|late|absen/.test(q)) {
      const d = ctx.dtr;
      if (!d) return "I don't have your attendance summary loaded yet.";
      return `You're at a ${d.onTimeRatePercent}% on-time rate this month — ${d.lateCount} late, ${d.absentCount} absences.`;
    }
    if (/\bface id\b|\bfaceid\b/.test(q)) {
      return ctx.employee?.faceEnrolled
        ? "Your Face ID is already enrolled — you can clock in remotely with a face scan."
        : "Face ID isn't enrolled yet. Enroll it under 201 File to unlock remote face-scan clock-in.";
    }
    if (/\bdepartment|position|office|cluster|employee id\b/.test(q)) {
      const e = ctx.employee;
      if (!e) return "I don't have your profile loaded yet.";
      return `${e.position}, ${e.department} (${e.cluster} cluster), ${e.office}. Employee ID ${e.id}.`;
    }
  }

  // ---- Manager ----
  if (ctx.role === "manager") {
    if (/\bapproval|pending|waiting\b/.test(q)) {
      if (!ctx.approvals?.length) return "You're all caught up — no pending approvals.";
      return `You have ${ctx.approvals.length} pending: ${ctx.approvals
        .map((r) => `${r.employeeName} (${r.type}, ${r.detail})`)
        .join("; ")}.`;
    }
    if (/\bteam|roster|who.*(report|work for)\b/.test(q)) {
      if (!ctx.roster?.length) return "I don't have your team roster loaded yet.";
      return `Your team (${ctx.roster.length}): ${ctx.roster.map((m) => `${m.name} (${m.status})`).join(", ")}.`;
    }
    if (/\balert|flag|pattern|workforce\b/.test(q)) {
      if (!ctx.alerts?.length) return "No workforce patterns flagged right now.";
      return ctx.alerts.map((a) => `${a.employeeName}: ${a.message}`).join("\n");
    }
  }

  // ---- Admin/HR ----
  if (ctx.role === "admin") {
    if (/\bheadcount|how many employees\b/.test(q)) {
      const s = ctx.stats;
      if (!s) return "I don't have company stats loaded yet.";
      return `Total headcount is ${s.totalHeadcount}, with ${s.newHiresThisMonth} new hires this month and ${s.attritionRateYtd}% attrition YTD.`;
    }
    if (/\bpayroll|cutoff\b/.test(q)) {
      const s = ctx.stats;
      if (!s) return "I don't have payroll stats loaded yet.";
      return `The current payroll run totals ${formatPHP(s.payrollRunTotal)}, cutoff ${s.payrollCutoffLabel}.`;
    }
    if (/\bcompliance|overdue|filing|due soon\b/.test(q)) {
      return `${ctx.complianceOverdueCount ?? 0} filing(s) overdue and ${ctx.complianceDueSoonCount ?? 0} due soon. Check the Compliance page for details.`;
    }
  }

  return "I'm not sure about that one — I can only answer from data already in this system (try asking about leave, payslips, attendance, or, depending on your role, your team or compliance).";
}
