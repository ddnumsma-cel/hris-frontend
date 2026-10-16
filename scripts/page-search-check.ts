// The top-bar page search: the sidebar's pages (already filtered to what the user may open), matched as you type.
// Run: npm run check:pages
import { flattenNav, matchPages } from "../src/components/layout/navIndex";

let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (!ok) failed++;
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(extra));
};

const pages = flattenNav([
  { title: "", items: [{ label: "Home", to: "/admin", end: true }] },
  {
    title: "Maintenance",
    items: [
      { label: "People", to: "/admin/maintenance/people" },
      { label: "Leave", to: "/admin/maintenance/leave", children: [{ label: "Requests", to: "/admin/maintenance/leave/requests" }, { label: "Leave types", to: "/admin/maintenance/leave/types" }] },
    ],
  },
  { title: "Attendance", items: [{ label: "Attendance", to: "/admin/timekeeping", children: [{ label: "Shifts", to: "/admin/timekeeping/shifts" }, { label: "Schedules", to: "/admin/timekeeping/schedules" }] }] },
  { title: "Pinned", items: [{ label: "Shifts", to: "/admin/timekeeping/shifts" }] },
]);

check("every page is listed once (a pinned copy isn't repeated)", pages.filter((p) => p.to === "/admin/timekeeping/shifts").length === 1, pages);
check("sub-pages carry where they live", pages.find((p) => p.to === "/admin/maintenance/leave/types")?.trail === "Maintenance › Leave", pages);
check("a page with sub-pages is listed too", pages.some((p) => p.to === "/admin/maintenance/leave"));

const find = (q: string) => matchPages(pages, q).map((p) => p.to);
check("'shif' finds Shifts", find("shif")[0] === "/admin/timekeeping/shifts", find("shif"));
check("matching ignores case and spaces around", find("  PEOPLE ")[0] === "/admin/maintenance/people", find("  PEOPLE "));
check("the group name finds its pages ('leave' → Leave and its sub-pages)", ["/admin/maintenance/leave", "/admin/maintenance/leave/requests", "/admin/maintenance/leave/types"].every((t) => find("leave").includes(t)), find("leave"));
check("names that start with the text come first", find("s")[0] === "/admin/timekeeping/schedules" || find("s")[0] === "/admin/timekeeping/shifts", find("s"));
check("blank text finds nothing", find("   ").length === 0);
check("no match finds nothing", find("zzz").length === 0);
check("at most 8 results", matchPages([...Array(20)].map((_, i) => ({ label: `Page ${i}`, to: `/p/${i}`, trail: "" })), "page").length === 8);

console.log(failed ? `\n${failed} FAILED` : "\nAll passed");
process.exit(failed ? 1 : 0);
