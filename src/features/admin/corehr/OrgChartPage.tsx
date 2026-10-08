import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { getOrgChart, setCompanyHead, setReportsTo, type OrgChart } from "@/lib/corehr/api";
import { useCan } from "@/lib/useCan";
import { inputClass, useActor } from "./format";
import { Drawer, ErrorNote, Field, Initials, LoadError } from "./ui";
import { CanvasView } from "./orgchart/CanvasView";
import { buildTree, type Person, type Tree } from "./orgchart/tree";

const KEY = ["corehr", "org-chart"] as const;

function PersonPanel({ p, chart, tree, canEdit, onClose, onOpen }: { p: Person; chart: OrgChart; tree: Tree; canEdit: boolean; onClose: () => void; onOpen: (p: Person) => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const isHead = p.id === chart.headId;
  // Can't report to themselves or to anyone in their own team.
  const below = new Set<string>();
  const walk = (id: string) => tree.kidsOf(id).forEach((k) => (below.add(k.id), walk(k.id)));
  walk(p.id);
  const choices = chart.people.filter((x) => x.id !== p.id && !below.has(x.id));
  const [supervisorId, setSupervisorId] = useState(p.supervisorId && p.supervisorId !== chart.headId ? p.supervisorId : (chart.headId ?? ""));
  const done = (msg: string) => {
    queryClient.invalidateQueries({ queryKey: ["corehr"] });
    toast.show(msg);
  };
  const save = useMutation({ mutationFn: () => setReportsTo(p.id, supervisorId || null, actor), onSuccess: () => done("Saved. The chart is updated.") });
  const head = useMutation({ mutationFn: () => setCompanyHead(p.id, actor), onSuccess: () => (done(`${p.name} is now the head of the company.`), onClose()) });
  const team = tree.kidsOf(p.id);
  const boss = chart.people.find((x) => x.id === tree.parentOf(p));

  return (
    <Drawer
      open
      onClose={onClose}
      title={p.name}
      subtitle={`${p.positionTitle} · ${p.departmentName}${p.branchName ? ` · ${p.branchName}` : ""}`}
      footer={
        <span className="flex flex-wrap justify-end gap-2 pr-16">
          <Link to={`/admin/maintenance/people/${p.id}`} className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium hover:border-ink-3">
            Open full profile
          </Link>
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Initials initials={p.initials} size="lg" />
          <div className="min-w-0 text-sm">
            <div className="font-semibold">{isHead ? "Head of the company" : boss ? `Reports to ${boss.name}` : "Reports to no one yet"}</div>
            <div className="text-ink-2">{team.length ? `Leads ${team.length} ${team.length === 1 ? "person" : "people"} directly, ${tree.count(p.id)} in all` : "No one reports to them"}</div>
          </div>
        </div>

        {canEdit && !isHead && (
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-end gap-2">
              <Field id="oc-sup" label="Reports to" className="flex-1">
                <select id="oc-sup" className={inputClass} value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
                  {!chart.headId && <option value="">No one</option>}
                  {choices.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} · {x.positionTitle}
                      {x.id === chart.headId ? " (head)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Button disabled={save.isPending || supervisorId === (p.supervisorId ?? chart.headId ?? "")} onClick={() => save.mutate()} className="mb-5">
                Save
              </Button>
            </div>
            <button type="button" disabled={head.isPending} onClick={() => window.confirm(`Make ${p.name} the head of the company? They'll appear at the top of the chart.`) && head.mutate()} className="text-xs font-medium text-brand hover:underline">
              Make {p.name.split(" ")[0]} the head of the company
            </button>
            <ErrorNote error={save.error ?? head.error} />
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold">Their team</h3>
          {team.length === 0 ? (
            <p className="text-sm text-ink-3">No one reports to {p.name.split(" ")[0]}.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {team.slice(0, 8).map((k) => (
                <li key={k.id}>
                  <button type="button" onClick={() => onOpen(k)} className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-surface-2">
                    <Initials initials={k.initials} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{k.name}</span>
                      <span className="block truncate text-xs text-ink-2">{k.positionTitle}</span>
                    </span>
                  </button>
                </li>
              ))}
              {team.length > 8 && <li className="text-xs text-ink-3">and {team.length - 8} more</li>}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function ChooseHead({ chart }: { chart: OrgChart }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [id, setId] = useState("");
  const save = useMutation({
    mutationFn: () => setCompanyHead(id, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      toast.show("Head of the company set.");
    },
  });
  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-xl border border-dashed border-ink-3 bg-surface p-3">
      <div className="text-sm font-semibold">Who is the head of the company?</div>
      <div className="flex gap-2">
        <select aria-label="Head of the company" className={inputClass} value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Choose a person</option>
          {chart.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.positionTitle}
            </option>
          ))}
        </select>
        <Button disabled={!id || save.isPending} onClick={() => save.mutate()}>
          Set
        </Button>
      </div>
      <ErrorNote error={save.error} />
    </div>
  );
}

export function OrgChartPage() {
  const chart = useQuery({ queryKey: KEY, queryFn: getOrgChart, staleTime: 0 });
  const canEdit = useCan("edit", "orgChart");
  const [openId, setOpenId] = useState<string | null>(null);

  if (chart.isError) return <LoadError onRetry={() => chart.refetch()} />;
  const data = chart.data;
  const tree = data ? buildTree(data) : null;
  const open = data?.people.find((p) => p.id === openId);

  return (
    <>
      <ContentHead
        title="Org chart"
        subtitle="Who reports to whom, from the head of the company down. Click anyone to see their team or change who they report to."
        actions={
          data && (
            <select aria-label="Find someone" className={clsx(inputClass, "h-9 w-56 py-0")} value="" onChange={(e) => e.target.value && setOpenId(e.target.value)}>
              <option value="">Find someone…</option>
              {data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )
        }
      />

      {chart.isLoading || !data || !tree ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {!data.headId && (canEdit ? <ChooseHead chart={data} /> : <p className="text-sm text-ink-3">No head of the company set yet.</p>)}
          <CanvasView chart={data} tree={tree} onOpen={setOpenId} />
        </>
      )}

      {open && data && tree && <PersonPanel key={open.id} p={open} chart={data} tree={tree} canEdit={canEdit} onClose={() => setOpenId(null)} onOpen={(k) => setOpenId(k.id)} />}
    </>
  );
}
