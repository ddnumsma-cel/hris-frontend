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
import { fmtDays, isoToday, previewRequest, type FileInput } from "@/lib/leave/api";
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
  const after = preview.balance && !preview.balance.unlimited ? preview.balance.available - preview.days : null;
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
            <div className="font-semibold">{preview.balance ? fmtDays(preview.balance.available) : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-ink-2">Left after</div>
            <div className={clsx("font-semibold", after !== null && after < 0 && "text-critical")}>{after === null ? (preview.balance?.unlimited ? "Unpaid" : "—") : fmtDays(after)}</div>
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

function BalanceCard({ b }: { b: MyLeave["balances"][number] }) {
  const total = b.earned + b.carriedOver + b.adjusted;
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="truncate text-xs font-semibold text-ink-2">{b.type.name}</div>
      {b.unlimited ? (
        <div className="mt-1 font-display text-2xl font-semibold">{num(b.used)}<span className="ml-1 text-xs font-normal text-ink-2">days taken</span></div>
      ) : (
        <>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-semibold">{num(b.available)}</span>
            <span className="text-xs text-ink-2">of {num(total)} days left</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-brand" style={{ width: `${total ? Math.min(100, ((b.used + b.pending) / total) * 100) : 0}%` }} />
          </div>
        </>
      )}
      <div className="mt-1.5 text-xs text-ink-3">
        Used {num(b.used)}
        {b.pending > 0 && ` · ${num(b.pending)} waiting`}
      </div>
    </div>
  );
}

export function EmployeeLeave() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: KEY, queryFn: myLeave, staleTime: 0 });
  const [filing, setFiling] = useState(false);
  const [allBalances, setAllBalances] = useState(false);
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

  const balances = data.data?.balances ?? [];
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
        subtitle="Your balances for this year and the leave you've asked for. HR approves every request."
        actions={
          <Button icon={<CalendarIcon className="h-3.75 w-3.75" />} onClick={() => setFiling(true)}>
            File leave
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.isLoading ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />) : balances.slice(0, 4).map((b) => <BalanceCard key={b.typeId} b={b} />)}
      </div>
      {balances.length > 4 && (
        <button type="button" onClick={() => setAllBalances(true)} className="-mt-3 self-start text-xs font-medium text-brand hover:underline">
          See all {balances.length} leave types
        </button>
      )}
      <div>
        <h2 className="mb-2 text-sm font-semibold">My requests</h2>
        <SimpleTable rows={data.data?.requests ?? []} rowKey={(r) => r.id} cols={cols} loading={data.isLoading} empty="You haven't filed any leave yet." />
      </div>

      {filing && <FileMyLeaveDialog onClose={() => setFiling(false)} />}
      {allBalances && (
        <Dialog open size="lg" onClose={() => setAllBalances(false)} title="All my leave balances">
          <div className="grid gap-3 sm:grid-cols-2">
            {balances.map((b) => (
              <BalanceCard key={b.typeId} b={b} />
            ))}
          </div>
        </Dialog>
      )}
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
