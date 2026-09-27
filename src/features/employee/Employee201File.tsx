import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { BriefcaseIcon, CameraIcon, DownloadIcon, EditIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { enrollFaceId, fetchCurrentEmployee, fetchMyAssets } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { Employee } from "@/lib/types";
import { EditProfileDialog } from "./EditProfileDialog";
import { FaceScanDialog } from "./FaceScanDialog";
import { print201File } from "./printTemplates";

const statusVariant: Record<Employee["status"], ChipVariant> = {
  Active: "good",
  "On leave": "neutral",
};

export function Employee201File() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);
  const employeeQuery = useQuery({ queryKey: ["employee", "me"], queryFn: fetchCurrentEmployee });
  const assetsQuery = useQuery({ queryKey: ["employee", "my-assets"], queryFn: fetchMyAssets });
  const employee = employeeQuery.data;

  const enrollMutation = useMutation({
    mutationFn: enrollFaceId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "me"] });
      setFaceEnrollOpen(false);
      toast.show("Face ID enrolled. You can now clock in remotely with a face scan.");
    },
  });

  function download() {
    if (!employee) return;
    print201File(employee);
  }

  return (
    <>
      <ContentHead
        title="201 File"
        subtitle={formatToday()}
        actions={
          <>
            <Button variant="ghost" icon={<EditIcon className="h-3.75 w-3.75" />} onClick={() => setEditOpen(true)} disabled={!employee}>
              Edit profile
            </Button>
            <Button icon={<DownloadIcon className="h-3.75 w-3.75" />} onClick={download} disabled={!employee}>
              Print summary
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader title="Employment record" />
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-base font-bold text-ink-2">
              {employee?.initials ?? <Skeleton className="h-4 w-6 rounded-full" />}
            </span>
            <div>
              <div className="font-display text-base font-bold">
                {employee?.name ?? <Skeleton className="h-4.5 w-32" />}
              </div>
              <div className="text-xs text-ink-2">{employee?.position ?? ""}</div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold text-ink-2">Employee ID</dt>
              <dd className="font-num mt-0.5">{employee?.id ?? <Skeleton className="h-4 w-20" />}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-2">Status</dt>
              <dd className="mt-0.5">
                {employee ? <Chip variant={statusVariant[employee.status]}>{employee.status}</Chip> : <Skeleton className="h-5 w-16" />}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-2">Department</dt>
              <dd className="mt-0.5">{employee?.department ?? <Skeleton className="h-4 w-24" />}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-2">Office</dt>
              <dd className="mt-0.5">{employee?.office ?? <Skeleton className="h-4 w-20" />}</dd>
            </div>
          </dl>

          <div className="grid grid-cols-1 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold text-ink-2">Email</dt>
              <dd className="mt-0.5">{employee?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-2">Phone</dt>
              <dd className="mt-0.5">{employee?.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-2">Emergency contact</dt>
              <dd className="mt-0.5">{employee?.emergencyContact ?? "—"}</dd>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Face ID" meta="Remote work verification" />
        <CardBody className="flex items-center justify-between gap-2.5">
          <div>
            <div className="text-[0.85rem] font-semibold">
              {employee?.faceEnrolled ? "Enrolled" : "Not enrolled"}
            </div>
            <p className="text-xs text-ink-2">
              {employee?.faceEnrolled
                ? "You can clock in remotely using a face scan."
                : "Enroll your face to clock in when working from home."}
            </p>
          </div>
          {employee?.faceEnrolled ? (
            <Chip variant="good">Enrolled</Chip>
          ) : (
            <Button
              variant="ghost"
              icon={<CameraIcon className="h-3.75 w-3.75" />}
              onClick={() => setFaceEnrollOpen(true)}
            >
              Enroll Face ID
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="My assets" meta="Company-issued equipment" />
        <CardBody className="flex flex-col gap-3">
          {assetsQuery.data?.length === 0 && (
            <EmptyState icon={<BriefcaseIcon />} title="No company assets are issued to you" />
          )}
          {assetsQuery.data?.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2.5">
              <div>
                <div className="text-[0.85rem] font-semibold">{a.type}</div>
                <div className="text-xs text-ink-2">
                  {a.assetTag} · Issued {a.issuedOn}
                </div>
              </div>
              <Chip variant={a.status === "Issued" ? "good" : a.status === "Under repair" ? "warn" : "neutral"}>
                {a.status}
              </Chip>
            </div>
          ))}
        </CardBody>
      </Card>

      <EditProfileDialog
        open={editOpen}
        employee={employee ?? null}
        onClose={() => setEditOpen(false)}
        onSubmitted={() => toast.show("Your profile has been updated.")}
      />

      <FaceScanDialog
        open={faceEnrollOpen}
        mode="enroll"
        onClose={() => setFaceEnrollOpen(false)}
        onSuccess={() => enrollMutation.mutate()}
      />
    </>
  );
}
