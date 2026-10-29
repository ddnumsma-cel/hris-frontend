import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { listShiftMoves, undoShiftMove, type ShiftMove } from "@/lib/timekeeping/api";
import { toIsoDate } from "@/lib/timekeeping/compute";
import { fmtDayShort, fmtTime } from "@/lib/preferences";
import { timeAgo } from "@/lib/timeAgo";
import { useActor } from "../../corehr/format";
import { ErrorNote, Initials } from "../../corehr/ui";
import { tkKeys } from "../format";
import { useShifts } from "./shared";

const DAYS = 7;
/** Earlier changes listed before pointing to the audit trail. */
const MAX_ROWS = 6;

/** "Today", "Yesterday", then "Oct 12", for the day a move happened (local time). */
function dayLabel(at: string) {
  const day = toIsoDate(new Date(at));
  const today = toIsoDate(new Date());
  const yesterday = toIsoDate(new Date(Date.now() - 86_400_000));
  return day === today ? "Today" : day === yesterday ? "Yesterday" : fmtDayShort(day);
}

/**
 * The side panel while nobody is ticked: the latest shift change (with Undo and a way to tick
 * those people again), then earlier changes from the last week, grouped by day.
 */
export function RecentMoves({ onShow, canEdit }: { onShow: (ids: string[]) => void; canEdit: boolean }) {
  const s = useShifts();
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: tkKeys.shiftMoves, queryFn: () => listShiftMoves(DAYS) });
  const undo = useMutation({
    mutationFn: (batch: string) => undoShiftMove(batch, actor),
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      toast.show(n === 1 ? "1 person is back on their old shift." : `${n} people are back on their old shifts.`);
    },
  });

  const shiftName = (id: string | null) => s.shifts.find((x) => x.id === id)?.name ?? "No usual shift";
  const dotOf = (id: string | null) => (s.shifts.some((x) => x.id === id) ? s.dot(id!) : "border border-dashed border-ink-3");
  const moves = q.data ?? [];
  const [latest, ...rest] = moves;
  // Earlier moves, one row per person, grouped by day.
  const days: { label: string; rows: { key: string; name: string; initials: string; from: string | null; to: string | null; at: string; actor: string; undone: boolean }[] }[] = [];
  let shown = 0;
  let hidden = 0;
  for (const m of rest) {
    for (const p of m.people) {
      // Keep the panel short: the rest are in the audit trail.
      if (shown >= MAX_ROWS) {
        hidden++;
        continue;
      }
      const label = dayLabel(m.at);
      let d = days.find((x) => x.label === label);
      if (!d) days.push((d = { label, rows: [] }));
      d.rows.push({ key: `${m.batch}-${p.id}`, name: p.name, initials: p.initials, from: p.from, to: m.to, at: m.at, actor: m.actor, undone: m.undone });
      shown++;
    }
  }
  const changes = moves.reduce((n, m) => n + m.people.length, 0);

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="move-title" className="text-base font-semibold">
            Recent moves
          </h2>
          <p className="mt-1 text-[13px] text-ink-2">Shift changes in the last {DAYS} days</p>
        </div>
        {changes > 0 && (
          <span className="flex-none rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-ink-2">
            {changes} {changes === 1 ? "change" : "changes"}
          </span>
        )}
      </div>

      {q.isLoading ? null : !latest ? (
        <p className="rounded-[var(--radius-control)] bg-surface-2 p-3 text-[13px] text-ink-2">No shift changes in the last {DAYS} days.</p>
      ) : (
        <LatestMove
          move={latest}
          shiftName={shiftName}
          dotOf={dotOf}
          canUndo={canEdit && !latest.undone && !latest.undoOf}
          undoing={undo.isPending}
          onUndo={() => undo.mutate(latest.batch)}
          onShow={() => onShow(latest.people.map((p) => p.id))}
        />
      )}
      <ErrorNote error={undo.error} />

      {days.map((d) => (
        <div key={d.label} className="flex flex-col">
          <h3 className="mb-1 text-xs font-medium text-ink-2">{d.label}</h3>
          {d.rows.map((r) => (
            <div key={r.key} className="flex gap-3 border-t border-[var(--line)] py-2">
              <Initials initials={r.initials} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold">{r.name}</span>
                  <span className="text-xs whitespace-nowrap text-ink-3">{fmtTime(r.at)}</span>
                </span>
                <span className={clsx("flex flex-wrap items-center gap-1 text-xs text-ink-3", r.undone && "line-through decoration-[var(--line-hover)]")}>
                  <span className={clsx("h-2 w-2 rounded-full", dotOf(r.from))} aria-hidden="true" />
                  {shiftName(r.from)}
                  <span aria-hidden="true">→</span>
                  <span className="sr-only">to</span>
                  <span className={clsx("h-2 w-2 rounded-full", dotOf(r.to))} aria-hidden="true" />
                  <span className="font-medium text-ink">{shiftName(r.to)}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-ink-3">
                  by {r.actor}
                  {r.undone && <span className="rounded-full bg-surface-2 px-2 text-[11px] font-medium text-ink-2">Undone</span>}
                </span>
              </span>
            </div>
          ))}
        </div>
      ))}
      {hidden > 0 && <p className="-mt-2 text-xs text-ink-3">{hidden} more in the audit trail.</p>}

      <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <span className="text-xs text-ink-3">{canEdit ? "Tick people in the list to move them." : "Only HR can move people."}</span>
        <Link to="/admin/administration/audit" className="text-xs font-medium whitespace-nowrap text-brand hover:underline">
          Audit trail
        </Link>
      </div>
    </>
  );
}

function LatestMove({ move, shiftName, dotOf, canUndo, undoing, onUndo, onShow }: { move: ShiftMove; shiftName: (id: string | null) => string; dotOf: (id: string | null) => string; canUndo: boolean; undoing: boolean; onUndo: () => void; onShow: () => void }) {
  const froms = [...new Set(move.people.map((p) => p.from))];
  const names = move.people.map((p) => p.name);
  return (
    <section aria-label="Latest move" className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--sky)_35%,transparent)] bg-brand-tint p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-brand uppercase">{move.undoOf ? "Latest · undo" : "Latest"}</span>
        <span className="text-xs text-ink-2">
          {timeAgo(move.at, fmtDayShort)} · by {move.actor}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center gap-2 rounded-full bg-[var(--field-bg)] px-3 text-xs font-medium">
          {froms.length === 1 && <span className={clsx("h-2 w-2 rounded-full", dotOf(froms[0]!))} aria-hidden="true" />}
          {froms.length === 1 ? shiftName(froms[0]!) : "Different shifts"}
        </span>
        <span aria-hidden="true" className="text-ink-3">
          →
        </span>
        <span className="sr-only">to</span>
        <span className="inline-flex h-7 items-center gap-2 rounded-full bg-[var(--field-bg)] px-3 text-xs font-medium">
          <span className={clsx("h-2 w-2 rounded-full", dotOf(move.to))} aria-hidden="true" />
          {shiftName(move.to)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex flex-none -space-x-2">
          {move.people.slice(0, 4).map((p) => (
            <span key={p.id} className="rounded-full border-2 border-[var(--field-bg)]">
              <Initials initials={p.initials} size="sm" />
            </span>
          ))}
        </span>
        <span className="min-w-0 text-[13px] leading-snug">
          <b className="font-semibold">{move.people.length === 1 ? names[0] : `${move.people.length} people`}</b>
          {move.people.length > 1 && (
            <span className="line-clamp-2 text-xs text-ink-2">
              {names[0]}
              {` and ${names.length - 1} more`}
            </span>
          )}
        </span>
      </div>
      <div className="flex gap-2">
        {canUndo && (
          <Button variant="ghost" className="flex-1 justify-center" disabled={undoing} onClick={onUndo}>
            {undoing ? "Undoing…" : "Undo"}
          </Button>
        )}
        <Button variant="ghost" className="flex-1 justify-center text-brand" onClick={onShow}>
          Show {move.people.length === 1 ? "this person" : "these people"}
        </Button>
      </div>
    </section>
  );
}
