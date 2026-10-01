import clsx from "clsx";
import { fieldByKey, type DirectoryRowData } from "./directoryFields";

/** A small verified-documents bar, used on cards and in the table. */
export function DocumentProgress({ data }: { data: DirectoryRowData }) {
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
      {c.missing > 0 && <span className="flex-none text-[0.7rem] font-semibold text-warning">{c.missing} missing</span>}
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
  return (
    <dl className={clsx("flex flex-col text-xs", className)}>
      {keys.map((key) => {
        const field = fieldByKey(key);
        if (!field) return null;
        const value = field.value(data);
        const line = (
          <div className="flex min-w-0 items-center gap-3 py-[3px]">
            <dt className="w-[6.5rem] flex-none truncate text-ink-3">{field.label}</dt>
            <dd className="flex min-w-0 flex-1 items-center truncate font-medium text-ink">
              {key === "documents" ? <DocumentProgress data={data} /> : (value ?? <span className="font-normal text-ink-3">—</span>)}
            </dd>
          </div>
        );
        return open ? (
          <div key={key} data-flip-key={key} data-open={open.has(key)} aria-hidden={!open.has(key)} className="cz-line">
            <div className="min-h-0 overflow-hidden">{line}</div>
          </div>
        ) : (
          <div key={key}>{line}</div>
        );
      })}
    </dl>
  );
}
