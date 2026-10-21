import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastContext";
import { CheckSquareIcon, ChevronRightIcon, FileIcon } from "@/components/icons";
import { myId } from "@/lib/ess/api";
import { acknowledgePolicy, openPolicyFile, policiesFor, type MyPolicy } from "@/lib/policies";

const KEY = ["employee", "policies"] as const;
const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
const needsAck = (p: MyPolicy) => p.requireAck && !p.acknowledgedAt;

function StatusChip({ p }: { p: MyPolicy }) {
  return needsAck(p) ? <Chip variant="warn">Please read</Chip> : p.acknowledgedAt ? <Chip variant="good">Read {shortDate(p.acknowledgedAt)}</Chip> : null;
}

/** The policy text with its numbered sections ("1. Work hours") as headings. */
function PolicyText({ body }: { body: string }) {
  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed">
      {body.split(/\n\s*\n/).map((b, i) => {
        const [first, ...rest] = b.split("\n");
        return /^\d+\.\s/.test(first ?? "") ? (
          <section key={i}>
            <h3 className="mb-1 text-sm font-semibold text-ink">{first}</h3>
            <p className="whitespace-pre-line text-ink-2">{rest.join("\n")}</p>
          </section>
        ) : (
          <p key={i} className="whitespace-pre-line text-ink-2">
            {b}
          </p>
        );
      })}
    </div>
  );
}

/** The reading window's footer: open the attached document, confirm reading it. */
function PolicyActions({ p, className }: { p: MyPolicy; className?: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const ack = useMutation({
    mutationFn: () => acknowledgePolicy(p.id, myId()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.show(`Thanks. HR can see you've read ${p.title}.`);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't save that.", "critical"),
  });
  if (!p.fileId && !needsAck(p)) return null;
  return (
    <div className={clsx("flex flex-wrap items-center gap-2", className)}>
      {p.fileId && (
        <Button size="sm" variant="ghost" onClick={() => openPolicyFile(p.fileId!)}>
          Open {p.fileName ?? "document"}
        </Button>
      )}
      {needsAck(p) && (
        <Button loading={ack.isPending} succeeded={ack.isSuccess} size="sm" className="ml-auto" disabled={ack.isPending} onClick={() => ack.mutate()}>
          I have read and understood this
        </Button>
      )}
    </div>
  );
}

/** Company rules and policies the employee reads and confirms: a grid of tiles (to read first), each opening in a reading window. */
export function EmployeePolicies() {
  const list = useQuery({ queryKey: KEY, queryFn: () => policiesFor(myId()), staleTime: 0 });
  const [id, setId] = useState<string | null>(null);
  const policies = list.data ?? [];
  const waiting = policies.filter(needsAck).length;
  const open = policies.find((p) => p.id === id);
  return (
    <>
      <ContentHead title="Company policies" subtitle={waiting ? `${waiting} ${waiting === 1 ? "policy needs" : "policies need"} your confirmation that you've read ${waiting === 1 ? "it" : "them"}.` : undefined} />
      {list.data?.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState icon={<CheckSquareIcon />} title="No company policies published yet" />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {policies.map((p) => (
            <article key={p.id} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface p-4">
              <span className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[var(--radius-logo)] bg-[var(--accent-tint)] text-brand">
                  <FileIcon className="h-4 w-4" />
                </span>
                <StatusChip p={p} />
              </span>
              <span>
                <span className="block text-xs font-medium tracking-[0.1em] text-ink-3 uppercase">{p.category}</span>
                <span className="mt-1 block text-sm font-semibold">{p.title}</span>
                <span className="mt-1 line-clamp-2 block text-xs text-ink-2">{p.summary}</span>
              </span>
              <span className="mt-auto flex items-center justify-between text-xs text-ink-3">
                <span>
                  v{p.version} · {shortDate(p.effectiveDate)}
                </span>
                <button type="button" onClick={() => setId(p.id)} aria-label={`Read ${p.title}`} className="flex items-center gap-1 rounded-[var(--radius-control)] font-medium text-brand-ink hover:underline">
                  Read <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            </article>
          ))}
        </div>
      )}
      {open && (
        <Dialog open size="lg" onClose={() => setId(null)} title={open.title} footer={<PolicyActions p={open} className="w-full" />}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
              {open.category} · Version {open.version} · Takes effect {shortDate(open.effectiveDate)}
              <StatusChip p={open} />
            </div>
            {open.summary && <p className="rounded-[var(--radius-control)] bg-surface-2 px-4 py-3 text-sm text-ink">{open.summary}</p>}
            {open.body && <PolicyText body={open.body} />}
          </div>
        </Dialog>
      )}
    </>
  );
}
