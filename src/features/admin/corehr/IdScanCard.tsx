import { useEffect, useRef, useState, type DragEvent } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { AlertTriangleIcon, CheckIcon, IdCardIcon, LoaderIcon, UploadIcon, XIcon } from "@/components/icons";
import { CONFIDENT, idTypeOptions, scanIdImageDetailed, type IdScanResult, type ScannedField, type ScannedIdFields, type ScanProgress } from "@/lib/idScan";

type ScanState =
  | { status: "idle" }
  | { status: "scanning"; progress: ScanProgress }
  | { status: "review"; result: IdScanResult }
  | { status: "done"; filled: number; idType?: string }
  | { status: "error"; message: string };

const ROWS: { key: ScannedField; label: string; type?: "date" | "sex" | "idType" }[] = [
  { key: "lastName", label: "Last name" },
  { key: "firstName", label: "First name" },
  { key: "middleName", label: "Middle name" },
  { key: "suffix", label: "Suffix" },
  { key: "birthDate", label: "Birth date", type: "date" },
  { key: "sex", label: "Sex", type: "sex" },
  { key: "idType", label: "ID type", type: "idType" },
  { key: "idNumber", label: "ID number" },
  { key: "idExpiry", label: "Expires", type: "date" },
];

const rowInput =
  "h-9 w-full rounded-lg border bg-surface px-2.5 text-sm text-ink outline-none transition-colors focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/20";

/** Upload a photo of a government ID. The scanner (lib/idScan) reads it; HR then
 * checks what was read, side by side with the photo, before anything is filled. */
export function IdScanCard({ onScanned, onCleared }: { onScanned: (fields: ScannedIdFields, file: File) => number; onCleared: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState>({ status: "idle" });
  const [draft, setDraft] = useState<ScannedIdFields>({});
  const [use, setUse] = useState<Set<ScannedField>>(new Set());
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function handle(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setScan({ status: "error", message: "Upload a photo or scan of the ID (JPG, PNG or WebP)." });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setScan({ status: "scanning", progress: { stage: "Checking for QR code", progress: 0 } });
    try {
      const result = await scanIdImageDetailed(f, (progress) => setScan({ status: "scanning", progress }));
      const found = (Object.keys(result.fields) as ScannedField[]).filter((k) => result.fields[k]);
      if (found.length === 0) {
        setScan({ status: "done", filled: 0 });
        return;
      }
      setDraft(result.fields);
      // Pre-tick only what the scanner is confident about; the rest waits for HR.
      setUse(new Set(found.filter((k) => (result.confidence[k] ?? 0) >= CONFIDENT)));
      setScan({ status: "review", result });
    } catch (e) {
      setScan({ status: "error", message: e instanceof Error ? e.message : "We couldn't read that ID. Fill in the details manually." });
    }
  }

  function apply() {
    if (!file || scan.status !== "review") return;
    const chosen: ScannedIdFields = {};
    for (const k of use) if (draft[k]) (chosen as Record<string, string>)[k] = draft[k]!;
    const filled = onScanned(chosen, file);
    setScan({ status: "done", filled, idType: chosen.idType });
  }

  function clear() {
    setFile(null);
    setPreview(null);
    setDraft({});
    setUse(new Set());
    setScan({ status: "idle" });
    if (input.current) input.current.value = "";
    onCleared();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (scan.status !== "scanning") handle(e.dataTransfer.files[0]);
  }

  if (scan.status === "review") {
    const { result } = scan;
    const unsure = ROWS.filter((r) => draft[r.key] && (result.confidence[r.key] ?? 0) < CONFIDENT).length;
    return (
      <section aria-labelledby="idscan-title" className="rise-in overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <h3 id="idscan-title" className="flex-1 text-sm font-semibold">
            Check what we read
          </h3>
          {unsure > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-tint px-2 py-0.5 text-[0.7rem] font-semibold text-warning">
              <AlertTriangleIcon className="h-3 w-3" />
              {unsure} unclear, please check
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-good-tint px-2 py-0.5 text-[0.7rem] font-semibold text-good">
              <CheckIcon className="h-3 w-3" />
              {result.source === "qr" ? "Read from the QR code" : "Everything read clearly"}
            </span>
          )}
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          {preview && (
            <a href={preview} target="_blank" rel="noreferrer" className="self-start" title="Open the full photo">
              <img src={preview} alt="Uploaded ID" className="w-full rounded-xl border border-border object-contain" />
              <span className="mt-1 block text-center text-[0.7rem] text-ink-3">Open full size to compare</span>
            </a>
          )}
          <ul className="flex flex-col gap-1.5">
            {ROWS.map((r) => {
              const value = draft[r.key];
              const conf = result.confidence[r.key] ?? 0;
              const ok = conf >= CONFIDENT;
              const checked = use.has(r.key);
              if (!value)
                return (
                  <li key={r.key} className="flex items-center gap-3 px-1 py-1 text-xs text-ink-3">
                    <span className="w-24 flex-none">{r.label}</span>
                    <span className="italic">Not found on the ID</span>
                  </li>
                );
              const id = `scan-${r.key}`;
              const set = (v: string) => setDraft((d) => ({ ...d, [r.key]: v }));
              return (
                <li key={r.key} className={clsx("flex items-center gap-3 rounded-lg px-1 py-1", !ok && "bg-warning-tint/50")}>
                  <input
                    type="checkbox"
                    aria-label={`Use ${r.label}`}
                    checked={checked}
                    onChange={(e) => setUse((s) => (e.target.checked ? new Set([...s, r.key]) : new Set([...s].filter((x) => x !== r.key))))}
                    className="h-4 w-4 flex-none accent-[var(--color-ink)]"
                  />
                  <label htmlFor={id} className="w-24 flex-none text-xs text-ink-2">
                    {r.label}
                  </label>
                  {r.type === "sex" ? (
                    <select id={id} value={value} onChange={(e) => set(e.target.value)} className={clsx(rowInput, ok ? "border-border" : "border-warning")}>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  ) : r.type === "idType" ? (
                    <select id={id} value={value} onChange={(e) => set(e.target.value)} className={clsx(rowInput, ok ? "border-border" : "border-warning")}>
                      {idTypeOptions.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input id={id} type={r.type === "date" ? "date" : "text"} value={value} onChange={(e) => set(e.target.value)} className={clsx(rowInput, "font-num", ok ? "border-border" : "border-warning")} />
                  )}
                  <span className={clsx("hidden w-20 flex-none text-right text-[0.68rem] font-medium sm:block", ok ? "text-good" : "text-warning")}>{ok ? "Clear" : "Unclear"}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2/50 px-4 py-3">
          <p className="mr-auto text-xs text-ink-2">Ticked values go into the form. Unclear ones stay unticked until you check them against the photo.</p>
          <Button variant="ghost" size="sm" onClick={clear}>
            Discard scan
          </Button>
          <Button size="sm" icon={<CheckIcon className="h-3.5 w-3.5" />} onClick={apply} disabled={use.size === 0}>
            Use {use.size} value{use.size === 1 ? "" : "s"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={clsx("rounded-2xl border-2 border-dashed p-4 transition-colors", dragging ? "border-brand bg-brand-tint" : scan.status === "done" && scan.filled > 0 ? "border-good/50 bg-good-tint/40" : "border-border bg-surface-2/50")}
    >
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Upload a photo of an ID" onChange={(e) => handle(e.target.files?.[0])} />
      <div className="flex flex-wrap items-center gap-4">
        {preview ? (
          <img src={preview} alt="Uploaded ID" className="h-16 w-24 flex-none rounded-lg border border-border object-cover" />
        ) : (
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-surface text-ink-3 shadow-sm">
            <IdCardIcon className="h-6 w-6" />
          </span>
        )}
        <div className="min-w-[12rem] flex-1">
          {scan.status === "idle" && (
            <>
              <p className="text-sm font-semibold">Upload an ID to auto-fill</p>
              <p className="text-xs text-ink-2">PhilSys, UMID, driver's license, passport, PRC and more. You'll check what was read before anything is filled.</p>
            </>
          )}
          {scan.status === "scanning" && (
            <>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                {scan.progress.stage}
                {scan.progress.pass && scan.progress.pass > 1 ? `, double-checking (${scan.progress.pass} of ${scan.progress.passes})` : ""}…
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${Math.max(8, Math.round(scan.progress.progress * 100))}%` }} />
              </div>
            </>
          )}
          {scan.status === "done" && (
            <>
              <p className="text-sm font-semibold">
                {scan.filled > 0 ? `Filled ${scan.filled} field${scan.filled === 1 ? "" : "s"} from ${scan.idType && scan.idType !== "Other" ? scan.idType : "the ID"}` : "Couldn't read any details clearly"}
              </p>
              <p className="text-xs text-ink-2">
                {scan.filled > 0 ? "Fields marked From ID came from the scan." : "Try a sharper, well-lit photo with the whole card flat and in frame, or fill in the form manually."}
              </p>
            </>
          )}
          {scan.status === "error" && (
            <>
              <p className="text-sm font-semibold text-critical">Couldn't read the ID</p>
              <p className="text-xs text-ink-2">{scan.message}</p>
            </>
          )}
        </div>
        <div className="flex flex-none items-center gap-1">
          {scan.status !== "scanning" && (
            <Button type="button" variant="ghost" size="sm" icon={<UploadIcon className="h-3.5 w-3.5" />} onClick={() => input.current?.click()}>
              {file ? "Scan another" : "Upload an ID"}
            </Button>
          )}
          {file && scan.status !== "scanning" && (
            <button type="button" onClick={clear} aria-label="Remove uploaded ID" title="Remove" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface hover:text-ink">
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
