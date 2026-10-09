import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";
import { addHoliday, changeHolidayForYear, dateOf, listHolidayChanges, listHolidayRules, listHolidays, removeHoliday, undoHolidayChange, type Holiday, type HolidayType } from "@/lib/holidays";
import { state as core } from "@/lib/corehr/store";
import { useCan } from "@/lib/useCan";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { SimpleTable } from "./common";
import { MonthView } from "./HolidayViews";

/** The active offices from Maintenance > Locations, so a new office can have local holidays too. */
const officeNames = () => core.units.filter((u) => u.type === "branch" && u.active).map((u) => u.name).sort();
const KEY = ["holidays"] as const;
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
const isLocal = (h: Holiday) => !!h.offices?.length;
function AddDialog({ year, onClose }: { year: number; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<HolidayType>("regular");
  const [date, setDate] = useState(`${year}-01-01`);
  const [everyYear, setEveryYear] = useState(false);
  const [offices, setOffices] = useState<string[]>([]);
  const [source, setSource] = useState("");
  const save = useMutation({
    mutationFn: () => addHoliday({ name, type, date, everyYear, offices, source }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show(`${name} added. Attendance and payroll treat it as a ${type === "regular" ? "regular holiday" : "special day"}.`);
      onClose();
    },
  });
  const toggle = (o: string) => setOffices((l) => (l.includes(o) ? l.filter((x) => x !== o) : [...l, o]));
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a holiday"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Add holiday
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">For holidays proclaimed each year (Eid&#39;l Fitr, Eid&#39;l Adha, declared special days) and local holidays such as a city&#39;s charter day.</p>
        <Field id="ah-name" label="Holiday">
          <input id="ah-name" className={inputClass} value={name} placeholder="e.g. Eid'l Fitr" onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="ah-date" label="Date">
            <input id="ah-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field id="ah-type" label="Type" hint="Sets the pay rate for work that day.">
            <select id="ah-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value as HolidayType)}>
              <option value="regular">Regular holiday</option>
              <option value="special">Special non-working day</option>
            </select>
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold text-ink-2">Repeats</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={!everyYear} onChange={() => setEveryYear(false)} /> This year only (the date changes every year)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={everyYear} onChange={() => setEveryYear(true)} /> Every year on this date
          </label>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold text-ink-2">Offices</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={!offices.length} onClick={() => setOffices([])} className={clsx("rounded-full border px-4 py-2 text-xs font-medium", !offices.length ? "border-ink bg-ink text-surface" : "border-border bg-surface")}>
              All offices (national)
            </button>
            {officeNames().map((o) => (
              <button key={o} type="button" aria-pressed={offices.includes(o)} onClick={() => toggle(o)} className={clsx("rounded-full border px-4 py-2 text-xs font-medium", offices.includes(o) ? "border-ink bg-ink text-surface" : "border-border bg-surface")}>
                {o}
              </button>
            ))}
          </div>
        </fieldset>
        <Field id="ah-source" label="Source" required>
          <input id="ah-source" className={inputClass} value={source} placeholder="e.g. Proclamation No. 123, s. 2026" onChange={(e) => setSource(e.target.value)} />
        </Field>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

function ChangeDialog({ h, year, onClose }: { h: Holiday; year: number; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"move" | "cancel">("move");
  const [date, setDate] = useState(h.date);
  const [source, setSource] = useState("");
  const save = useMutation({
    mutationFn: () => changeHolidayForYear({ ruleId: h.ruleId!, year, kind, date, source }, actor),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show(kind === "move" ? `${h.name} moved to ${longDate(date)} for ${year}.` : `${h.name} is cancelled for ${year}.`);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Change ${h.name} for ${year}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={kind === "cancel" ? "danger" : "primary"} disabled={save.isPending} onClick={() => save.mutate()}>
            {kind === "move" ? "Move it" : "Cancel it this year"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">Only {year} changes; other years keep the usual date. Use this when a proclamation moves a holiday (for example to the nearest Monday) or doesn&#39;t declare it.</p>
        <fieldset className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={kind === "move"} onChange={() => setKind("move")} /> Move to another date
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={kind === "cancel"} onChange={() => setKind("cancel")} /> Not a holiday this year
          </label>
        </fieldset>
        {kind === "move" && (
          <Field id="ch-date" label="New date">
            <input id="ch-date" type="date" min={`${year}-01-01`} max={`${year}-12-31`} className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
        <Field id="ch-source" label="Proclamation" required>
          <input id="ch-source" className={inputClass} value={source} placeholder="e.g. Proclamation No. 456, s. 2026" onChange={(e) => setSource(e.target.value)} />
        </Field>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

/** The year's holidays for HR: national, movable and local, with changes from proclamations. */
export function HolidayCalendarPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canEdit = useCan("edit", "attendanceSettings");
  const [year, setYear] = useState(new Date().getFullYear());
  const [adding, setAdding] = useState(false);
  const [changing, setChanging] = useState<Holiday | null>(null);
  const holidays = useQuery({ queryKey: [...KEY, year], queryFn: () => listHolidays(year) });
  const changes = useQuery({ queryKey: [...KEY, "changes", year], queryFn: () => listHolidayChanges(year) });
  const rules = useQuery({ queryKey: [...KEY, "rules"], queryFn: listHolidayRules });
  const done = (msg: string) => (queryClient.invalidateQueries(), toast.show(msg));
  const undo = useMutation({ mutationFn: (ruleId: string) => undoHolidayChange(ruleId, year), onSuccess: () => done("Back on its usual date.") });
  const remove = useMutation({ mutationFn: (ruleId: string) => removeHoliday(ruleId), onSuccess: () => done("Holiday removed."), onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't remove.", "critical") });

  if (holidays.isError) return <LoadError onRetry={() => holidays.refetch()} />;
  const list = holidays.data ?? [];
  const ruleOf = (id?: string) => rules.data?.find((r) => r.id === id);
  const changeOf = (id?: string) => changes.data?.find((c) => c.ruleId === id);
  // Cancelled this year: shown in the list so HR can undo.
  const cancelled = (changes.data ?? [])
    .filter((c) => c.kind === "cancel")
    .flatMap((c) => {
      const r = ruleOf(c.ruleId);
      const d = r && dateOf(r, year);
      return r && d ? [{ date: d, name: r.name, type: r.type, source: c.source, offices: r.offices, ruleId: r.id, how: "Cancelled this year", cancelled: true }] : [];
    });
  const rows = [...list.map((h) => ({ ...h, cancelled: false })), ...cancelled].sort((a, b) => a.date.localeCompare(b.date));
  const count = (f: (h: Holiday) => boolean) => list.filter(f).length;

  return (
    <>
      <ContentHead
        title="Holiday calendar"
        subtitle="Regular and special holidays for the year. Attendance and payroll use these dates, so pay rates follow what you set here."
        actions={
          canEdit ? (
            <Button icon={<PlusIcon className="h-3.75 w-3.75" />} onClick={() => setAdding(true)}>
              Add holiday
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="font-display text-xl font-semibold">{year}</span>
          <Button size="sm" variant="ghost" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-critical" /> Regular holiday ({count((h) => h.type === "regular" && !isLocal(h))})
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-warning" /> Special non-working day ({count((h) => h.type === "special" && !isLocal(h))})
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-cat-1" /> Local holiday ({count(isLocal)})
          </li>
        </ul>
      </div>

      <MonthView year={year} holidays={list} onYear={setYear} />

      <h2 className="mt-2 font-display text-base font-semibold">All holidays in {year}</h2>
      <SimpleTable
        rows={rows}
        rowKey={(h) => `${h.ruleId}-${h.date}`}
        loading={holidays.isLoading}
        empty="No holidays this year."
        cols={[
          { header: "Date", cell: (h) => <span className={clsx("font-medium", h.cancelled && "text-ink-3 line-through")}>{longDate(h.date)}</span> },
          { header: "Holiday", cell: (h) => <span className={clsx(h.cancelled && "text-ink-3 line-through")}>{h.name}</span> },
          { header: "Type", cell: (h) => (isLocal(h) ? <Pill tone="info">Local · {h.offices!.join(", ")}</Pill> : <Pill tone={h.type === "regular" ? "crit" : "warn"}>{h.type === "regular" ? "Regular" : "Special"}</Pill>) },
          { header: "Date rule", cell: (h) => <span className="text-ink-2">{h.how}</span> },
          { header: "Source", cell: (h) => <span className="inline-block max-w-56 truncate align-bottom text-xs text-ink-2" title={h.source}>{h.source}</span> },
          {
            header: "",
            align: "right",
            cell: (h) => {
              if (!canEdit) return null;
              const rule = ruleOf(h.ruleId);
              const changed = changeOf(h.ruleId);
              return (
                <span className="flex justify-end gap-2">
                  {changed ? (
                    <Button size="sm" variant="ghost" disabled={undo.isPending} onClick={() => undo.mutate(h.ruleId!)}>
                      Undo change
                    </Button>
                  ) : rule && rule.repeat.kind !== "once" ? (
                    <Button size="sm" variant="ghost" onClick={() => setChanging(h)}>
                      Move or cancel
                    </Button>
                  ) : null}
                  {rule && !rule.builtIn && (
                    <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => window.confirm(`Remove ${rule.name}${rule.repeat.kind === "fixed" ? " from every year" : ""}?`) && remove.mutate(rule.id)}>
                      Remove
                    </Button>
                  )}
                </span>
              );
            },
          },
        ]}
      />
      <p className="text-xs text-ink-3">Eid&#39;l Fitr and Eid&#39;l Adha are proclaimed each year: add them with &ldquo;Add holiday&rdquo; once the dates are announced. Local holidays count only for that office&#39;s employees.</p>

      {adding && <AddDialog year={year} onClose={() => setAdding(false)} />}
      {changing && <ChangeDialog h={changing} year={year} onClose={() => setChanging(null)} />}
    </>
  );
}
