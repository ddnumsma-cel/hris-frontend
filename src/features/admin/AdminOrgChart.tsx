import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody } from "@/components/ui/Card";
import { fetchOrgChart } from "@/lib/api";
import { formatToday } from "@/lib/format";

function OrgNode({
  name,
  initials,
  title,
  children,
}: {
  name: string;
  initials: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex w-56 flex-col items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-3 text-center shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-ink">
          {initials}
        </span>
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-xs text-ink-2">{title}</div>
      </div>
      {children && (
        <>
          <div className="h-5 w-px bg-border" />
          <div className="flex flex-wrap items-start justify-center gap-6">{children}</div>
        </>
      )}
    </div>
  );
}

export function AdminOrgChart() {
  const orgQuery = useQuery({ queryKey: ["admin", "org-chart"], queryFn: fetchOrgChart });
  const data = orgQuery.data;

  return (
    <>
      <ContentHead title="Org Chart" subtitle={formatToday()} />

      <Card>
        <CardBody className="overflow-x-auto">
          {data && (
            <div className="flex min-w-max justify-center py-4">
              <OrgNode name={data.root.name} initials={data.root.initials} title={data.root.title}>
                {data.employees
                  .filter((e) => e.reportsToId === "admin")
                  .map((lead) => (
                    <OrgNode key={lead.id} name={lead.name} initials={lead.initials} title={lead.position}>
                      {data.employees
                        .filter((e) => e.reportsToId === lead.id)
                        .map((report) => (
                          <OrgNode key={report.id} name={report.name} initials={report.initials} title={report.position} />
                        ))}
                    </OrgNode>
                  ))}
              </OrgNode>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
