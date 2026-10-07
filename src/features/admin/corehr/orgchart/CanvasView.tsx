import { departmentColors, layoutTree } from "./layout";
import { PanZoom } from "./PanZoom";
import type { OrgViewProps } from "./tree";

const COL = 210;
const ROW = 190;
const CARD_W = 176;
const CARD_H = 132;

/** Design G: the whole chart on a drawing board, with curved lines. Drag to move, zoom to fit. */
export function CanvasView({ chart, tree, onOpen }: OrgViewProps) {
  const { placed, byId, leaves, depth } = layoutTree(tree);
  const { names, colorOf } = departmentColors(chart.people);
  const width = leaves * COL;
  const height = (depth + 1) * ROW;
  const at = (slot: number, d: number) => ({ cx: slot * COL + COL / 2, top: d * ROW + 20 });

  return (
    <div className="flex flex-col gap-3">
      <PanZoom
        width={width}
        height={height}
        footer={
          <ul className="flex max-w-[60vw] flex-wrap gap-x-3 gap-y-1 rounded-xl border border-border bg-surface px-3 py-2 text-[0.7rem] text-ink-2 shadow-sm">
            {names.map((n) => (
              <li key={n} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(n) }} />
                {n}
              </li>
            ))}
          </ul>
        }
      >
        <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
          {placed
            .filter((n) => n.parentId)
            .map((n) => {
              const parent = byId.get(n.parentId!)!;
              const a = at(parent.slot, parent.depth);
              const b = at(n.slot, n.depth);
              const y1 = a.top + CARD_H;
              const y2 = b.top;
              const mid = (y1 + y2) / 2;
              return <path key={n.p.id} d={`M ${a.cx} ${y1} C ${a.cx} ${mid}, ${b.cx} ${mid}, ${b.cx} ${y2}`} fill="none" stroke="var(--color-border)" strokeWidth={2} />;
            })}
        </svg>
        {placed.map((n) => {
          const { cx, top } = at(n.slot, n.depth);
          const color = colorOf(n.p.departmentName);
          const team = tree.count(n.p.id);
          return (
            <button
              key={n.p.id}
              type="button"
              onClick={() => onOpen(n.p.id)}
              className="lift absolute flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface px-3 pt-3 pb-2.5 text-center shadow-sm hover:border-brand"
              style={{ left: cx - CARD_W / 2, top, width: CARD_W, height: CARD_H }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-sm font-semibold text-ink" style={{ boxShadow: `0 0 0 3px ${color}` }}>
                {n.p.initials}
              </span>
              <span className="mt-1 w-full truncate text-sm font-semibold">{n.p.name}</span>
              <span className="w-full truncate text-[0.7rem] text-ink-2">{n.p.positionTitle}</span>
              {team > 0 && <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-surface px-2 text-[0.65rem] font-semibold text-ink-2">{team}</span>}
            </button>
          );
        })}
      </PanZoom>
      <p className="text-xs text-ink-3">Drag the board to move around. Each ring color is a department; the number under a card is the size of that person's team.</p>
    </div>
  );
}
