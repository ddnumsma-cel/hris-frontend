import clsx from "clsx";
import { DocumentsBoard } from "./documents/DocumentsBoard";
import { DocumentsCards } from "./documents/DocumentsCards";
import { DocumentsQueue } from "./documents/DocumentsQueue";
import { useLayout, type Layout } from "./documents/data";

const LAYOUTS: { value: Layout; label: string }[] = [
  { value: "queue", label: "A · Review queue" },
  { value: "cards", label: "B · Employee cards" },
  { value: "board", label: "C · Board" },
];

/** 201 file documents. Three layouts to choose from for now. */
export function DocumentsPage() {
  const [layout, setLayout] = useLayout();
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
  if (layout === "cards") return <DocumentsCards switcher={switcher} />;
  if (layout === "board") return <DocumentsBoard switcher={switcher} />;
  return <DocumentsQueue switcher={switcher} />;
}
