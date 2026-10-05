import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { CalendarIcon } from "@/components/icons";
import { fileMyLeave, myId, myLeave, withdrawMyLeave, type MyLeave } from "@/lib/ess/api";
import { fmtCredits, fmtDays, isoToday, previewRequest, type FileInput } from "@/lib/leave/api";
import { dateRange, num, STATUS } from "../admin/leave/format";
import { inputClass } from "../admin/corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../admin/corehr/ui";
import { SimpleTable, type Col } from "../admin/timekeeping/common";
import { shortDate } from "../admin/timekeeping/format";

const KEY = ["ess", "leave"] as const;
type MyRequest = MyLeave["requests"][number];

/** Everything an employee needs to file leave, with the days and balance worked out as they type. */
export function FileMyLeaveDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: KEY, queryFn: myLeave });
  const today = isoToday();
  const [form, setForm] = useState<Omit<FileInput, "employeeId">>({ typeId: "vl", start: today, end: today, reason: "" });
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const single = form.start === form.end;
  const input = { ...form, employeeId: myId(), halfDay: single ? form.halfDay : undefined };
  const preview = previewRequest(input);
  const file = useMutation({
    mutationFn: () => fileMyLeave({ ...form, halfDay: input.halfDay }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ess"] });
      queryClient.invalidateQueries({ queryKey: ["leave"] });
      toast.show("Leave sent to HR for approval.");
      onClose();
    },
  });
  const after = preview.credits ? preview.credits.available - 1 : null;
  // Only leave types this employee can use.
  const types = (data.data?.balances ?? []).filter((b) => b.eligible).map((b) => b.type);

  return (
    <Dialog
      open
      onClose={onClose}
      title="File leave"
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={file.isPending}
            onClick={() => {
              setTried(true);
              if (!preview.errors.length && form.reason.trim()) file.mutate();
            }}
          >
            Send to HR
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field id="my-type" label="Leave type" required className="col-span-2">
          <select id="my-type" className={inputClass} value={form.typeId} onChange={(e) => set({ typeId: e.target.value })}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="my-start" label="From" required>
          <input id="my-start" type="date" className={inputClass} value={form.start} onChange={(e) => set({ start: e.target.value, end: form.end < e.target.value ? e.target.value : form.end })} />
        </Field>
        <Field id="my-end" label="To" required>
          <input id="my-end" type="date" className={inputClass} min={form.start} value={form.end} onChange={(e) => set({ end: e.target.value })} />
        </Field>
        {single && (
          <div className="col-span-2 flex flex-wrap gap-1.5 text-sm" role="radiogroup" aria-label="How long">
            {(
              [
                [undefined, "Whole day"],
                ["am", "Morning only"],
                ["pm", "Afternoon only"],
              ] as const
            ).map(([v, label]) => (
              <button key={label} type="button" role="radio" aria-checked={form.halfDay === v} onClick={() => set({ halfDay: v })} className={clsx("h-8 rounded-full border px-3 font-medium", form.halfDay === v ? "border-ink bg-ink text-surface" : "border-border text-ink-2 hover:border-ink-3")}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="col-span-2 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 text-sm">
          <div>
            <div className="text-xs text-ink-2">You're taking</div>
            <div className="font-semibold">{fmtDays(preview.days)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-2">You have</div>
            <div className="font-semibold">{preview.credits ? fmtCredits(preview.credits.available) : preview.balance?.unlimited ? "Unpaid" : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-ink-2">Left after</div>
            <div className={clsx("font-semibold", after !== null && after < 0 && "text-critical")}>{after === null ? (preview.balance?.unlimited ? "Unpaid" : "—") : fmtCredits(after)}</div>
          </div>
          {(preview.notes.length > 0 || (tried && preview.errors.length > 0)) && (
            <ul className="col-span-3 flex flex-col gap-0.5 border-t border-border pt-2 text-xs">
              {tried && preview.errors.map((e) => <li key={e} className="text-critical">{e}</li>)}
              {preview.notes.map((n) => <li key={n} className="text-ink-2">{n}</li>)}
            </ul>
          )}
        </div>
        <Field id="my-why" label="Reason" required className="col-span-2" error={tried && !form.reason.trim() ? "Give a short reason" : undefined}>
          <input id="my-why" className={inputClass} value={form.reason} placeholder="e.g. Family trip" onChange={(e) => set({ reason: e.target.value })} />
        </Field>
        <Field id="my-file" label="Supporting document" className="col-span-2" hint="Needed for sick leave over 2 days, bereavement and statutory leave.">
          <input id="my-file" type="file" className="block w-full text-sm text-ink-2 file:mr-3 file:h-8 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:text-sm file:font-medium" onChange={(e) => set({ attachment: e.target.files?.[0]?.name })} />
        </Field>
        <div className="col-span-2">
          <ErrorNote error={file.error} />
        </div>
      </div>
    </Dialog>
  );
}

/** The yearly allowance: 6 leaves, any paid type, each one uses 1 however many days it covers. */
function CreditsCard({ data }: { data: MyLeave }) {
  const { total, used, pending, available } = data.credits;
  const year = isoToday().slice(0, 4);
  // One slot per leave: approved first (oldest first), then waiting, then the ones still free.
  const taken = data.requests
    .filter((r) => r.type.earning.kind !== "unlimited" && r.start.slice(0, 4) === year && (r.status === "approved" || r.status === "pending"))
    .sort((x, y) => (x.status === y.status ? x.start.localeCompare(y.start) : x.status === "approved" ? -1 : 1));
  const slots = Array.from({ length: total }, (_, i) => taken[i]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="credits-title">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex flex-none items-center gap-4 lg:w-60">
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-brand-tint text-brand-ink">
            <CalendarIcon className="h-6 w-6" />
          </span>
          <div>
            <h2 id="credits-title" className="text-xs font-semibold uppercase tracking-wide text-ink-2">
              Leave credits · {year}
            </h2>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-bold leading-none tracking-[-0.02em]">{available}</span>
              <span className="text-sm text-ink-2">of {total} left</span>
            </div>
          </div>
        </div>

        <ol className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-6" aria-label={`${used} used, ${pending} waiting for HR, ${available} left`}>
          {slots.map((r, i) => (
            <li
              key={r?.id ?? `free-${i}`}
              className={clsx(
                "flex h-[4.5rem] min-w-0 flex-col justify-between rounded-xl border px-2.5 py-2",
                !r && "border-dashed border-border bg-surface",
                r?.status === "approved" && "border-brand bg-brand text-white",
                r?.status === "pending" && "border-warning/40 bg-warning-tint",
              )}
            >
              <span className={clsx("font-num text-[0.7rem] font-semibold", r?.status === "approved" ? "text-white/70" : "text-ink-3")}>{i + 1}</span>
              {r ? (
                <span className="min-w-0">
                  <span className={clsx("block truncate text-xs font-semibold", r.status === "pending" && "text-warning")}>
                    {r.type.name.replace(/ leave$/, "")}
                  </span>
                  <span className={clsx("block truncate text-[0.7rem]", r.status === "approved" ? "text-white/75" : "text-ink-2")}>
                    {r.status === "pending" ? "Waiting" : dateRange(r.start, r.end)}
                  </span>
                </span>
              ) : (
                <span className="text-xs font-medium text-ink-3">Available</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border bg-surface-2/60 px-5 py-3 text-xs text-ink-2 sm:px-6">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Used <b className="font-semibold text-ink">{used}</b>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-warning" /> Waiting for HR <b className="font-semibold text-ink">{pending}</b>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-ink-3" /> Available <b className="font-semibold text-ink">{available}</b>
        </span>
        <span className="text-ink-3 sm:ml-auto">Each leave uses 1, however many days. Resets every January 1.</span>
      </div>
    </section>
  );
}

export function EmployeeLeave() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: KEY, queryFn: myLeave, staleTime: 0 });
  const [filing, setFiling] = useState(false);
  const [withdrawing, setWithdrawing] = useState<MyRequest | null>(null);
  const withdraw = useMutation({
    mutationFn: (r: MyRequest) => withdrawMyLeave(r.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ess"] });
      queryClient.invalidateQueries({ queryKey: ["leave"] });
      toast.show("Request withdrawn.");
      setWithdrawing(null);
    },
  });

  if (data.isError) return <LoadError onRetry={() => data.refetch()} />;

  const cols: Col<MyRequest>[] = [
    { header: "Leave type", cell: (r) => <span className="font-medium">{r.type.name}</span> },
    { header: "Dates", cell: (r) => `${dateRange(r.start, r.end)}${r.halfDay ? (r.halfDay === "am" ? " (morning)" : " (afternoon)") : ""}` },
    { header: "Days", cell: (r) => num(r.days) },
    { header: "Filed", cell: (r) => <span className="text-ink-2">{shortDate(r.filedAt)}</span> },
    {
      header: "Status",
      cell: (r) => (
        <span className="flex items-center gap-2" title={r.note}>
          <Pill tone={STATUS[r.status].tone}>{r.status === "pending" ? "Waiting for HR" : STATUS[r.status].label}</Pill>
          {r.note && r.status !== "cancelled" && <span className="max-w-48 truncate text-xs text-ink-3">{r.note}</span>}
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (r) =>
        r.status === "pending" ? (
          <Button size="sm" variant="ghost" onClick={() => setWithdrawing(r)}>
            Withdraw
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <ContentHead
        title="My leave"
        subtitle="Your leave credits for this year and the leave you've asked for. HR approves every request."
        actions={
          <Button icon={<CalendarIcon className="h-3.75 w-3.75" />} onClick={() => setFiling(true)}>
            File leave
          </Button>
        }
      />
      {data.data ? <CreditsCard data={data.data} /> : <Skeleton className="h-36" />}
      <div>
        <h2 className="mb-2 text-sm font-semibold">My requests</h2>
        <SimpleTable rows={data.data?.requests ?? []} rowKey={(r) => r.id} cols={cols} loading={data.isLoading} empty="You haven't filed any leave yet." />
      </div>

      {filing && <FileMyLeaveDialog onClose={() => setFiling(false)} />}
      {withdrawing && (
        <Dialog
          open
          onClose={() => setWithdrawing(null)}
          title="Withdraw this request?"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setWithdrawing(null)}>
                Keep it
              </Button>
              <Button variant="danger" disabled={withdraw.isPending} onClick={() => withdraw.mutate(withdrawing)}>
                Withdraw
              </Button>
            </div>
          }
        >
          <p className="text-sm text-ink-2">
            {withdrawing.type.name}, {dateRange(withdrawing.start, withdrawing.end)} ({fmtDays(withdrawing.days)}). HR won't see it anymore and the days go back to your balance.
          </p>
          <ErrorNote error={withdraw.error} />
        </Dialog>
      )}
    </>
  );
}
