import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { ChevronDownIcon } from "@/components/icons";
import { getOrgChart, setCompanyHead, setReportsTo, type OrgChart } from "@/lib/corehr/api";
import { useAccess } from "../administration/access";
import { inputClass, useActor } from "./format";
import { Drawer, ErrorNote, Field, Initials, LoadError } from "./ui";

type Person = OrgChart["people"][number];
const KEY = ["corehr", "org-chart"] as const;

/** Who each person reports to on the chart: their supervisor, or the head of the company if none is set. */
function buildTree(chart: OrgChart) {
  const ids = new Set(chart.people.map((p) => p.id));
  const parentOf = (p: Person) => (p.id === chart.headId ? undefined : p.supervisorId && ids.has(p.supervisorId) ? p.supervisorId : chart.headId);
  const kids = new Map<string | undefined, Person[]>();
  for (const p of chart.people) {
    const parent = parentOf(p);
    kids.set(parent, [...(kids.get(parent) ?? []), p]);
  }
  // Leads first, then by name.
  const count = (id: string): number => (kids.get(id) ?? []).reduce((n, k) => n + 1 + count(k.id), 0);
  for (const list of kids.values()) list.sort((a, b) => count(b.id) - count(a.id) || a.name.localeCompare(b.name));
  return { kidsOf: (id: string | undefined) => kids.get(id) ?? [], count, parentOf };
}

function Card({ p, reports, onOpen, top }: { p: Person; reports: number; onOpen: () => void; top?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx("lift flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left", top ? "border-transparent bg-ink text-bg" : "border-border bg-surface hover:border-ink-3")}
    >
      <Initials initials={p.initials} size={top ? "md" : "sm"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{p.name}</span>
        <span className={clsx("block truncate text-xs", top ? "text-bg/70" : "text-ink-2")}>{p.positionTitle}</span>
        {!top && <span className="block truncate text-[0.7rem] text-ink-3">{p.departmentName}</span>}
      </span>
      {reports > 0 && <span className={clsx("flex-none rounded-full px-1.5 text-[0.7rem] font-semibold", top ? "bg-surface/15" : "bg-surface-2 text-ink-2")}>{reports}</span>}
    </button>
  );
}

/** A person's team under their card, opened on request so the chart stays on one screen. */
function Team({ list, tree, onOpen, depth = 0 }: { list: Person[]; tree: ReturnType<typeof buildTree>; onOpen: (p: Person) => void; depth?: number }) {
  return (
    <ul className={clsx("flex flex-col gap-1.5 border-l-2 border-border/70", depth ? "ml-3 pl-2" : "ml-4 pl-3")}>
      {list.map((k) => (
        <li key={k.id}>
          <Card p={k} reports={tree.count(k.id)} onOpen={() => onOpen(k)} />
          {tree.kidsOf(k.id).length > 0 && depth < 2 && <Team list={tree.kidsOf(k.id)} tree={tree} onOpen={onOpen} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

function PersonPanel({ p, chart, tree, canEdit, onClose, onOpen }: { p: Person; chart: OrgChart; tree: ReturnType<typeof buildTree>; canEdit: boolean; onClose: () => void; onOpen: (p: Person) => void }) {
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
          <Link to={`/admin/people/${p.id}`} className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium hover:border-ink-3">
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
  const access = useAccess();
  const canEdit = access.company === "edit" || access.company === "approve";
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  if (chart.isError) return <LoadError onRetry={() => chart.refetch()} />;
  const data = chart.data;
  const tree = data ? buildTree(data) : null;
  const head = data?.people.find((p) => p.id === data.headId);
  const second = tree ? tree.kidsOf(data!.headId) : [];
  const open = data?.people.find((p) => p.id === openId);
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

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
        <div className="flex flex-col items-center">
          <div className="w-72">{head ? <Card p={head} top reports={tree.count(head.id)} onOpen={() => setOpenId(head.id)} /> : canEdit ? <ChooseHead chart={data} /> : <p className="text-center text-sm text-ink-3">No head of the company set yet.</p>}</div>
          {second.length > 0 && (
            <>
              <div className="h-5 w-px bg-border" />
              <div className="w-full border-t border-border" />
              <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-4 pt-4 md:grid-cols-3 xl:grid-cols-5">
                {second.map((p) => {
                  const team = tree.kidsOf(p.id);
                  const isOpen = expanded.has(p.id);
                  return (
                    <li key={p.id} className="flex min-w-0 flex-col">
                      <Card p={p} reports={tree.count(p.id)} onOpen={() => setOpenId(p.id)} />
                      {team.length > 0 && (
                        <button type="button" onClick={() => toggle(p.id)} aria-expanded={isOpen} className="mt-1 flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
                          <ChevronDownIcon className={clsx("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                          {isOpen ? "Hide team" : `Show team (${tree.count(p.id)})`}
                        </button>
                      )}
                      {isOpen && <div className="mt-1.5"><Team list={team} tree={tree} onOpen={(k) => setOpenId(k.id)} /></div>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {open && data && tree && <PersonPanel key={open.id} p={open} chart={data} tree={tree} canEdit={canEdit} onClose={() => setOpenId(null)} onOpen={(k) => setOpenId(k.id)} />}
    </>
  );
}
