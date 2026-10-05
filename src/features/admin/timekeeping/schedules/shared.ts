import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRoster, listShifts, type RosterCell, type RosterRow } from "@/lib/timekeeping/api";
import { addDays, toIsoDate, weekday } from "@/lib/timekeeping/compute";
import { useOfficeFilter } from "../../OfficeFilterContext";
import { tkKeys } from "../format";

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const mondayOf = (d: string) => addDays(d, -((weekday(d) + 6) % 7));
export const todayIso = () => toIsoDate(new Date());

/** One colour per shift, so the same shift looks the same everywhere. */
const TONES = [
  "bg-[color-mix(in_srgb,var(--color-cat-1)_14%,transparent)] text-cat-1",
  "bg-[color-mix(in_srgb,var(--color-cat-3)_16%,transparent)] text-cat-3",
  "bg-[color-mix(in_srgb,var(--color-cat-2)_14%,transparent)] text-cat-2",
  "bg-[color-mix(in_srgb,var(--color-cat-4)_18%,transparent)] text-[color-mix(in_srgb,var(--color-cat-4)_80%,black)]",
];
export const DOTS = ["bg-cat-1", "bg-cat-3", "bg-cat-2", "bg-cat-4"];

export function useShifts() {
  const q = useQuery({ queryKey: tkKeys.shifts, queryFn: listShifts });
  const shifts = (q.data ?? []).filter((s) => s.active);
  const indexOf = (id?: string) => Math.max(0, shifts.findIndex((s) => s.id === id)) % TONES.length;
  return { shifts, tone: (id?: string) => TONES[indexOf(id)]!, dot: (id?: string) => DOTS[indexOf(id)]! };
}

/** The roster for a week, filtered by office, search and department. */
export function useWeek() {
  const { office } = useOfficeFilter();
  const [week, setWeek] = useState(mondayOf(todayIso()));
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const rosterQuery = useQuery({ queryKey: tkKeys.roster(week), queryFn: () => getRoster(week) });
  const all = (rosterQuery.data ?? []).filter((r) => office === "All offices" || r.person.branch === office);
  const departments = [...new Map(all.map((r) => [r.person.departmentId, r.person.departmentName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const q = query.trim().toLowerCase();
  const rows = all.filter((r) => (!department || r.person.departmentId === department) && (!q || r.person.name.toLowerCase().includes(q)));
  return { week, setWeek, query, setQuery, department, setDepartment, departments, rows, all, days: Array.from({ length: 7 }, (_, i) => addDays(week, i)), query_: rosterQuery };
}

export const cellText = (c: RosterCell) => (c.kind === "work" ? c.label : c.kind === "rest" ? "Rest day" : c.kind === "leave" ? "On leave" : c.kind === "holiday" ? "Holiday" : "No shift");

export type Editing = { row: RosterRow; cell: RosterCell } | null;
