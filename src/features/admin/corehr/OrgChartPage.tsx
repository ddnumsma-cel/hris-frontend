import { useState } from "react";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Skeleton } from "@/components/ui/Skeleton";
import { inputClass } from "./format";
import { LoadError } from "./ui";
import { OutlineView } from "./orgchart/OutlineView";
import { ChooseHead, PersonPanel } from "./orgchart/shared";
import { TeamsView } from "./orgchart/TeamsView";
import { TreeView } from "./orgchart/TreeView";
import { useOrg } from "./orgchart/useOrg";

type Layout = "tree" | "teams" | "outline";
const LAYOUTS: { value: Layout; label: string }[] = [
  { value: "tree", label: "A · Tree" },
  { value: "teams", label: "B · By department" },
  { value: "outline", label: "C · Outline" },
];
const KEY = "heyhr-orgchart-layout";

/** Who reports to whom. Three layouts to choose from for now. */
export function OrgChartPage() {
  const org = useOrg();
  const [layout, setLayoutState] = useState<Layout>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "teams" || v === "outline" ? v : "tree";
    } catch {
      return "tree";
    }
  });
  const setLayout = (l: Layout) => {
    setLayoutState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // Not remembered; still switches now.
    }
  };

  if (org.chart.isError)
    return <LoadError onRetry={() => org.chart.refetch()} />;

  return (
    <>
      <ContentHead
        title="Org chart"
        subtitle="Who reports to whom. Click anyone to see their team or change who they report to."
        actions={
          <div className="flex items-center gap-2">
            <div
              role="radiogroup"
              aria-label="Layout to try"
              className="flex items-center gap-1 rounded-full border border-border bg-surface p-1"
            >
              <span className="px-2 text-xs whitespace-nowrap text-ink-3">
                Try a layout:
              </span>
              {LAYOUTS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={layout === l.value}
                  onClick={() => setLayout(l.value)}
                  className={clsx(
                    "h-7 rounded-full px-3 text-xs font-medium whitespace-nowrap",
                    layout === l.value
                      ? "bg-ink text-surface"
                      : "text-ink-2 hover:text-ink",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {org.data && (
              <select
                aria-label="Find someone"
                className={clsx(inputClass, "h-9 w-48 py-0")}
                value=""
                onChange={(e) =>
                  e.target.value && org.openPerson(e.target.value)
                }
              >
                <option value="">Find someone…</option>
                {org.data.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      />
      {org.data && !org.head && org.canEdit && !org.partnersLead && (
        <div className="flex justify-center">
          <ChooseHead chart={org.data} />
        </div>
      )}
      {org.chart.isLoading || !org.data || !org.tree ? (
        <Skeleton className="h-96 w-full" />
      ) : layout === "teams" ? (
        <TeamsView org={org} />
      ) : layout === "outline" ? (
        <OutlineView org={org} />
      ) : (
        <TreeView org={org} />
      )}
      {org.open && org.data && org.tree && (
        <PersonPanel
          key={org.open.id}
          p={org.open}
          chart={org.data}
          tree={org.tree}
          canEdit={org.canEdit}
          onClose={org.close}
          onOpen={(k) => org.openPerson(k)}
        />
      )}
    </>
  );
}
