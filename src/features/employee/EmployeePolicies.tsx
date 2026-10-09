import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastContext";
import { CheckSquareIcon } from "@/components/icons";
import { myId } from "@/lib/ess/api";
import { acknowledgePolicy, openPolicyFile, policiesFor, type MyPolicy } from "@/lib/policies";

const KEY = ["employee", "policies"] as const;
const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

function PolicyCard({ p }: { p: MyPolicy }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const needsAck = p.requireAck && !p.acknowledgedAt;
  const [open, setOpen] = useState(needsAck);
  const ack = useMutation({
    mutationFn: () => acknowledgePolicy(p.id, myId()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.show(`Thanks. HR can see you've read ${p.title}.`);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't save that.", "critical"),
  });
  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[0.95rem] font-semibold">{p.title}</div>
            <div className="text-xs text-ink-2">
              {p.category} · Version {p.version} · Takes effect {shortDate(p.effectiveDate)}
            </div>
          </div>
          {needsAck ? <Chip variant="warn">Please read</Chip> : p.acknowledgedAt ? <Chip variant="good">Read {shortDate(p.acknowledgedAt)}</Chip> : null}
        </div>
        {p.summary && <p className="text-sm text-ink-2">{p.summary}</p>}
        {open && p.body && <div className="max-h-96 overflow-y-auto whitespace-pre-line rounded-lg bg-surface-2 p-4 text-sm leading-relaxed">{p.body}</div>}
        <div className="flex flex-wrap items-center gap-2">
          {p.body && (
            <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
              {open ? "Hide policy" : "Read policy"}
            </Button>
          )}
          {p.fileId && (
            <Button size="sm" variant="ghost" onClick={() => openPolicyFile(p.fileId!)}>
              Open {p.fileName ?? "document"}
            </Button>
          )}
          {needsAck && (
            <Button size="sm" className="ml-auto" disabled={ack.isPending} onClick={() => ack.mutate()}>
              I have read and understood this
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/** Company rules and policies the employee reads and confirms. */
export function EmployeePolicies() {
  const list = useQuery({ queryKey: KEY, queryFn: () => policiesFor(myId()), staleTime: 0 });
  const waiting = (list.data ?? []).filter((p) => p.requireAck && !p.acknowledgedAt).length;
  return (
    <>
      <ContentHead title="Company policies" subtitle={waiting ? `${waiting} ${waiting === 1 ? "policy needs" : "policies need"} your confirmation that you've read ${waiting === 1 ? "it" : "them"}.` : "The company's rules and policies."} />
      <div className="flex flex-col gap-4">
        {list.data?.length === 0 && (
          <Card>
            <CardBody>
              <EmptyState icon={<CheckSquareIcon />} title="No company policies published yet" />
            </CardBody>
          </Card>
        )}
        {list.data?.map((p) => (
          <PolicyCard key={`${p.id}-${p.version}`} p={p} />
        ))}
      </div>
    </>
  );
}
