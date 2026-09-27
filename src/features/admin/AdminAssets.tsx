import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { BriefcaseIcon, EditIcon, SearchIcon, SearchXIcon } from "@/components/icons";
import { deleteCompanyAsset, fetchCompanyAssets } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { AssetStatus, CompanyAsset } from "@/lib/types";
import { EditAssetDialog } from "./EditAssetDialog";
import { IssueAssetDialog } from "./IssueAssetDialog";

const statusVariant: Record<AssetStatus, ChipVariant> = {
  Issued: "good",
  Returned: "neutral",
  "Under repair": "warn",
};

export function AdminAssets() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingAsset, setEditingAsset] = useState<CompanyAsset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<CompanyAsset | null>(null);
  const assetsQuery = useQuery({ queryKey: ["admin", "assets"], queryFn: fetchCompanyAssets });

  const deleteMutation = useMutation({
    mutationFn: deleteCompanyAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "assets"] });
      toast.show(`${deletingAsset?.type} (${deletingAsset?.assetTag}) removed from the register.`);
      setDeletingAsset(null);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assetsQuery.data ?? [];
    return (assetsQuery.data ?? []).filter(
      (a) =>
        a.type.toLowerCase().includes(q) ||
        a.assetTag.toLowerCase().includes(q) ||
        a.assignedToName.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q),
    );
  }, [assetsQuery.data, search]);

  return (
    <>
      <ContentHead
        title="Company Assets"
        subtitle={formatToday()}
        actions={
          <Button icon={<BriefcaseIcon className="h-3.75 w-3.75" />} onClick={() => setDialogOpen(true)}>
            Issue asset
          </Button>
        }
      />

      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 sm:max-w-xs">
        <SearchIcon className="h-3.5 w-3.5 text-ink-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search asset, tag, assignee…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
        />
      </div>

      {!assetsQuery.isLoading && filtered.length === 0 && (
        <Card>
          <EmptyState
            icon={<SearchXIcon />}
            title={`No assets match "${search}"`}
            description="Try a different asset, tag or assignee."
          />
        </Card>
      )}

      {(assetsQuery.isLoading || filtered.length > 0) && (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {assetsQuery.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-3.5">
                  <div className="skeleton h-14 w-full rounded-lg" />
                </Card>
              ))}
            {filtered.map((a) => (
              <Card key={a.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div>
                    <div className="text-sm font-bold">{a.type}</div>
                    <div className="font-num text-xs text-ink-2">{a.assetTag}</div>
                  </div>
                  <Chip variant={statusVariant[a.status]}>{a.status}</Chip>
                </div>
                <div className="mt-3 flex items-center gap-2.5 text-xs">
                  <MiniAvatar initials={a.assignedToInitials} />
                  <div>
                    <div className="font-semibold text-ink">{a.assignedToName}</div>
                    <div className="text-ink-3">Issued {a.issuedOn}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 border-t border-border pt-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditingAsset(a)}
                    className="flex items-center gap-1 font-semibold text-ink-2"
                  >
                    <EditIcon className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeletingAsset(a)} className="font-semibold text-critical">
                    Remove
                  </button>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.82rem]">
                <thead>
                  <tr>
                    {["Asset", "Tag", "Assigned to", "Issued", "Status", ""].map((h) => (
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
                  {assetsQuery.isLoading && <SkeletonRows columns={6} />}
                  {filtered.map((a) => (
                    <tr key={a.id}>
                      <td className="border-b border-border px-4 py-2.5 font-semibold">{a.type}</td>
                      <td className="font-num border-b border-border px-4 py-2.5">{a.assetTag}</td>
                      <td className="border-b border-border px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <MiniAvatar initials={a.assignedToInitials} />
                          {a.assignedToName}
                        </div>
                      </td>
                      <td className="border-b border-border px-4 py-2.5">{a.issuedOn}</td>
                      <td className="border-b border-border px-4 py-2.5">
                        <Chip variant={statusVariant[a.status]}>{a.status}</Chip>
                      </td>
                      <td className="border-b border-border px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setEditingAsset(a)}
                            className="flex items-center gap-1 font-semibold text-ink-2 hover:text-ink"
                          >
                            <EditIcon className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingAsset(a)}
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

      <IssueAssetDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmitted={() => toast.show("Asset issued and added to the register.")}
      />

      <EditAssetDialog
        asset={editingAsset}
        onClose={() => setEditingAsset(null)}
        onSubmitted={() => toast.show("Asset record updated.")}
      />

      <ConfirmDialog
        open={deletingAsset !== null}
        title="Remove asset"
        message={`Remove ${deletingAsset?.type} (${deletingAsset?.assetTag}) from the register? This can't be undone.`}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingAsset!.id)}
        onClose={() => setDeletingAsset(null)}
      />
    </>
  );
}
