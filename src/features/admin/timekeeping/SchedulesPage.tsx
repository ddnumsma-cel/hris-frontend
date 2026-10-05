import { useState } from "react";
import clsx from "clsx";
import { ShiftTeams } from "./schedules/ShiftTeams";
import { ShiftTimeline } from "./schedules/ShiftTimeline";
import { WeekCards } from "./schedules/WeekCards";

type Layout = "timeline" | "teams" | "cards";
const LAYOUTS: { value: Layout; label: string }[] = [
  { value: "timeline", label: "D · Shift timeline" },
  { value: "teams", label: "E · Shift teams" },
  { value: "cards", label: "F · Week cards" },
];
const KEY = "heyhr-schedules-layout-2";

/** Who works which shift. Three layouts to choose from for now. */
export function SchedulesPage() {
  const [layout, setLayoutState] = useState<Layout>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "teams" || v === "cards" ? v : "timeline";
    } catch {
      return "timeline";
    }
  });
  const setLayout = (l: Layout) => {
    setLayoutState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // Not remembered; still switches now.
    }
  };
  const switcher = (
    <div role="radiogroup" aria-label="Layout to try" className="-mb-2 flex items-center gap-1 self-end rounded-full border border-border bg-surface p-1">
      <span className="px-2 text-xs text-ink-3">Try a layout:</span>
      {LAYOUTS.map((l) => (
        <button key={l.value} type="button" role="radio" aria-checked={layout === l.value} onClick={() => setLayout(l.value)} className={clsx("h-7 rounded-full px-3 text-xs font-medium", layout === l.value ? "bg-ink text-surface" : "text-ink-2 hover:text-ink")}>
          {l.label}
        </button>
      ))}
    </div>
  );
  if (layout === "teams") return <ShiftTeams switcher={switcher} />;
  if (layout === "cards") return <WeekCards switcher={switcher} />;
  return <ShiftTimeline switcher={switcher} />;
}
