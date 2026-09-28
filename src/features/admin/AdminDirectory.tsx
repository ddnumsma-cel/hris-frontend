import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { SearchIcon, SearchXIcon, UserPlusIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EditIcon } from "@/components/icons";
import { PersonnelFileDialog } from "@/components/shared/PersonnelFileDialog";
import { deleteEmployee, fetchEmployeeDirectory } from "@/lib/api";
import { formatToday } from "@/lib/format";
import { clusterOptions } from "@/lib/schemas";
import type { Cluster, Employee } from "@/lib/types";
import { AddEmployeeDialog } from "./AddEmployeeDialog";
import { EditEmployeeDialog } from "./EditEmployeeDialog";
import { useOfficeFilter } from "./OfficeFilterContext";

const employeeStatusVariant: Record<Employee["status"], ChipVariant> = {
  Active: "good",
  "On leave": "neutral",
};

type ClusterFilter = "All clusters" | Cluster;

export function AdminDirectory() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [clusterFilter, setClusterFilter] = useState<ClusterFilter>("All clusters");
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [profileEmployee, setProfileEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const { office } = useOfficeFilter();

  const deleteMutation = useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employee-directory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview-stats"] });
      toast.show(`${deletingEmployee?.name} was removed from the directory.`);
      setDeletingEmployee(null);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byOffice = (directoryQuery.data ?? []).filter((e) => office === "All offices" || e.office === office);
    const byCluster = byOffice.filter((e) => clusterFilter === "All clusters" || e.cluster === clusterFilter);
    if (!q) return byCluster;
    return byCluster.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.office.toLowerCase().includes(q) ||
        e.cluster.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q),
    );
  }, [directoryQuery.data, search, office, clusterFilter]);

  return (
    <>
      <ContentHead
        title="Employee Directory"
        subtitle={`${office === "All offices" ? "All offices" : office} · ${formatToday()}`}
        actions={
          <Button icon={<UserPlusIcon className="h-3.75 w-3.75" />} onClick={() => setAddEmployeeOpen(true)}>
            Add employee
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 sm:max-w-xs sm:flex-1">
          <SearchIcon className="h-3.5 w-3.5 text-ink-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, department, office…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
        </div>
        <select
          value={clusterFilter}
          onChange={(e) => setClusterFilter(e.target.value as ClusterFilter)}
          aria-label="Filter by cluster"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        >
          <option value="All clusters">All clusters</option>
          {clusterOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {!directoryQuery.isLoading && filtered.length === 0 && (
        <Card>
          <EmptyState
            icon={<SearchXIcon />}
            title={search ? `No employees match "${search}"` : `No employees found for ${office}`}
            description={search ? "Try a different name, department or office." : undefined}
          />
        </Card>
      )}

      {(directoryQuery.isLoading || filtered.length > 0) && (
        <>
          {/* Mobile: card list (below sm) */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {directoryQuery.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-3.5">
                  <div className="skeleton h-14 w-full rounded-lg" />
                </Card>
              ))}
            {filtered.map((emp) => (
              <Card key={emp.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <MiniAvatar initials={emp.initials} />
                    <div>
                      <div className="text-sm font-bold">{emp.name}</div>
                      <div className="text-xs text-ink-2">{emp.id}</div>
                    </div>
                  </div>
                  <Chip variant={employeeStatusVariant[emp.status]}>{emp.status}</Chip>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <dt className="text-ink-3">Department</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{emp.department}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Cluster</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{emp.cluster}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Office</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{emp.office}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-center gap-4 border-t border-border pt-2.5 text-xs">
                  <button type="button" onClick={() => setProfileEmployee(emp)} className="font-semibold text-brand-ink">
                    Open 201
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingEmployee(emp)}
                    className="flex items-center gap-1 font-semibold text-ink-2"
                  >
                    <EditIcon className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeletingEmployee(emp)} className="font-semibold text-critical">
                    Remove
                  </button>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: table (sm and up) */}
          <Card className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.82rem]">
                <thead>
                  <tr>
                    {["Employee", "Department", "Cluster", "Office", "Status", "201 file"].map((h) => (
                      <th
                        key={h}
                        className="border-b border-border px-4 py-2.5 text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {directoryQuery.isLoading && <SkeletonRows columns={6} />}
                  {filtered.map((emp) => (
                    <tr key={emp.id}>
                      <td className="border-b border-border px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <MiniAvatar initials={emp.initials} />
                          <div>
                            <div>{emp.name}</div>
                            <div className="text-xs text-ink-2">{emp.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-border px-4 py-2.5">{emp.department}</td>
                      <td className="border-b border-border px-4 py-2.5">{emp.cluster}</td>
                      <td className="border-b border-border px-4 py-2.5">{emp.office}</td>
                      <td className="border-b border-border px-4 py-2.5">
                        <Chip variant={employeeStatusVariant[emp.status]}>{emp.status}</Chip>
                      </td>
                      <td className="border-b border-border px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setProfileEmployee(emp)}
                            className="font-semibold text-brand-ink"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingEmployee(emp)}
                            className="flex items-center gap-1 font-semibold text-ink-2 hover:text-ink"
                          >
                            <EditIcon className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingEmployee(emp)}
                            className="font-semibold text-critical"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <AddEmployeeDialog
        open={addEmployeeOpen}
        onClose={() => setAddEmployeeOpen(false)}
        onSubmitted={() => toast.show("New employee added to the directory.")}
      />

      <PersonnelFileDialog
        subject={
          profileEmployee && {
            id: profileEmployee.id,
            name: profileEmployee.name,
            initials: profileEmployee.initials,
            position: profileEmployee.position,
            department: profileEmployee.department,
            office: profileEmployee.office,
            cluster: profileEmployee.cluster,
            status: profileEmployee.status,
          }
        }
        onClose={() => setProfileEmployee(null)}
      />

      <EditEmployeeDialog
        employee={editingEmployee}
        onClose={() => setEditingEmployee(null)}
        onSubmitted={() => toast.show("Employee record updated.")}
      />

      <ConfirmDialog
        open={deletingEmployee !== null}
        title="Remove employee"
        message={`Remove ${deletingEmployee?.name} from the directory? This can't be undone.`}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingEmployee!.id)}
        onClose={() => setDeletingEmployee(null)}
      />
    </>
  );
}
