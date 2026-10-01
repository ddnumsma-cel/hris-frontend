import clsx from "clsx";
import { fieldByKey, type DirectoryRowData } from "./directoryFields";

/** A small verified-documents bar, used on cards and in the table. */
export function DocumentProgress({ data, compact = false }: { data: DirectoryRowData; compact?: boolean }) {
  const c = data.completion;
  if (!c) return <span className="text-ink-3">—</span>;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="h-1 min-w-10 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span data-motion="fill" className="block h-full rounded-full bg-good" style={{ width: `${c.pct}%` }} />
      </span>
      <span className="font-num flex-none text-[0.7rem] text-ink-3">
        {c.verified}/{c.applicable}
      </span>
      {c.missing > 0 && !compact && <span className="flex-none text-[0.7rem] font-semibold text-warning">{c.missing} missing</span>}
    </span>
  );
}

/** One person's chosen details as label / value lines, in HR's order. */
export function DirectoryDetails({
  keys,
  data,
  /** Preview mode: `keys` lists every field and only these open; the rest stay collapsed so they can grow in and out. */
  open,
  className,
}: {
  keys: string[];
  data: DirectoryRowData;
  open?: Set<string>;
  className?: string;
}) {
  // The animated preview nests each line in two wrappers, which <dl> doesn't allow, so it renders plain divs.
  const Wrapper = open ? "div" : "dl";
  const Term = open ? "span" : "dt";
  const Desc = open ? "span" : "dd";
  return (
    <Wrapper className={clsx("flex flex-col text-xs", className)}>
      {keys.map((key) => {
        const field = fieldByKey(key);
        if (!field) return null;
        const value = field.value(data);
        const line = (
          <div key={key} className="flex min-w-0 items-center gap-3 py-[3px]">
            <Term className="w-[6.5rem] flex-none truncate text-ink-3">{field.short ?? field.label}</Term>
            <Desc className="flex min-w-0 flex-1 items-center truncate font-medium text-ink">
              {key === "documents" ? <DocumentProgress data={data} compact /> : (value ?? <span className="font-normal text-ink-3">—</span>)}
            </Desc>
          </div>
        );
        return open ? (
          <div key={key} data-flip-key={key} data-open={open.has(key)} aria-hidden={!open.has(key)} className="cz-line">
            <div className="min-h-0 overflow-hidden">{line}</div>
          </div>
        ) : (
          line
        );
      })}
    </Wrapper>
  );
}
