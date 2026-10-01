import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { BriefcaseIcon, CameraIcon, DownloadIcon, EditIcon, FileIcon, UploadIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  enrollFaceId,
  fetchCurrentEmployee,
  fetchMyAssets,
  fetchMyOnboardingStatus,
  fetchMyPersonnelChecklist,
  fetchMyPhoto,
  fetchMyProfessionalLicense,
  removeMyPersonnelDocument,
  updateMyPhoto,
  uploadMyPersonnelDocument,
} from "@/lib/api";
import { getCpdStatus } from "@/lib/automation";
import { formatToday } from "@/lib/format";
import type { CpdStatus, Employee, PersonnelDocumentChecklistItem, PersonnelDocumentStatus } from "@/lib/types";
import { LogCpdUnitsDialog } from "@/components/shared/LogCpdUnitsDialog";
import { EditProfileDialog } from "./EditProfileDialog";
import { FaceScanDialog } from "./FaceScanDialog";
import { print201File } from "./printTemplates";

const statusVariant: Record<Employee["status"], ChipVariant> = {
  Active: "good",
  "On leave": "neutral",
};

const cpdVariant: Record<CpdStatus, ChipVariant> = {
  Compliant: "good",
  "In progress": "neutral",
  "Due soon": "warn",
  Overdue: "crit",
};

const checklistVariant: Record<PersonnelDocumentStatus, ChipVariant> = {
  Missing: "warn",
  Submitted: "neutral",
  Verified: "good",
  "Not applicable": "neutral",
};

export function Employee201File() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [faceEnrollOpen, setFaceEnrollOpen] = useState(false);
  const [logCpdOpen, setLogCpdOpen] = useState(false);
  const employeeQuery = useQuery({ queryKey: ["employee", "me"], queryFn: fetchCurrentEmployee });
  const assetsQuery = useQuery({ queryKey: ["employee", "my-assets"], queryFn: fetchMyAssets });
  const licenseQuery = useQuery({
    queryKey: ["employee", "professional-license"],
    queryFn: fetchMyProfessionalLicense,
  });
  const checklistQuery = useQuery({
    queryKey: ["employee", "personnel-checklist"],
    queryFn: fetchMyPersonnelChecklist,
  });
  const photoQuery = useQuery({ queryKey: ["employee", "my-photo"], queryFn: fetchMyPhoto });
  const onboardingQuery = useQuery({ queryKey: ["employee", "onboarding-status"], queryFn: fetchMyOnboardingStatus });
  const employee = employeeQuery.data;
  const license = licenseQuery.data;
  const cpd = license ? getCpdStatus(license) : null;

  const enrollMutation = useMutation({
    mutationFn: enrollFaceId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "me"] });
      setFaceEnrollOpen(false);
      toast.show("Face ID enrolled. You can now clock in remotely with a face scan.");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, fileName }: { id: string; fileName: string }) => uploadMyPersonnelDocument(id, fileName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "personnel-checklist"] });
      toast.show("Document uploaded — HR will verify it shortly.");
    },
  });

  const photoMutation = useMutation({
    mutationFn: updateMyPhoto,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", "my-photo"] }),
  });

  const removeMutation = useMutation({
    mutationFn: removeMyPersonnelDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "personnel-checklist"] });
      toast.show("Upload removed — you can submit it again.");
    },
  });

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload(doc: PersonnelDocumentChecklistItem, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    uploadMutation.mutate({ id: doc.id, fileName: file.name });
    if (doc.type === "Application Form / Resume" && file.type.startsWith("image/")) {
      const dataUrl = await readAsDataUrl(file);
      photoMutation.mutate(dataUrl);
    }
  }

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
            {photoQuery.data ? (
              <img src={photoQuery.data} alt="" className="h-12 w-12 flex-none rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-base font-semibold text-ink-2">
                {employee?.initials ?? <Skeleton className="h-4 w-6 rounded-full" />}
              </span>
            )}
            <div>
              <div className="font-display text-base font-semibold">
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
        <CardHeader title="Required documents" meta="Pre-employment & identity records" />
        <CardBody className="flex flex-col gap-3">
          <p className="text-xs text-ink-2">
            HR keeps the full record on file. This is your submission status — reach out to HR if something looks
            wrong.
          </p>
          {checklistQuery.isLoading && <Skeleton className="h-24 w-full" />}
          {checklistQuery.data?.length === 0 && onboardingQuery.data === "pending" && (
            <p className="rounded-lg bg-surface-2 px-3.5 py-3 text-sm">
              <span className="font-semibold">HR is finishing your setup.</span>{" "}
              <span className="text-ink-2">Your 201 checklist opens once they add your role and start date.</span>
            </p>
          )}
          {checklistQuery.data?.length === 0 && onboardingQuery.data === "none" && (
            <p className="rounded-lg bg-surface-2 px-3.5 py-3 text-sm">
              <span className="font-semibold">Your 201 file starts with Onboarding.</span>{" "}
              <Link to="/employee/onboarding" className="font-semibold text-brand-ink hover:underline">
                Fill in your details and upload your files
              </Link>
            </p>
          )}
          {checklistQuery.data
            ?.filter((doc) => doc.status !== "Not applicable")
            .map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <FileIcon className="h-4 w-4 flex-none text-ink-3" />
                  <span className="text-[0.85rem]">{doc.type}</span>
                </div>
                <div className="flex flex-none items-center gap-2.5">
                  <Chip variant={checklistVariant[doc.status]}>{doc.status}</Chip>
                  {(doc.status === "Missing" || doc.status === "Submitted") && (
                    <label className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-ink">
                      <UploadIcon className="h-3.5 w-3.5" />
                      {doc.status === "Missing" ? "Upload" : "Replace"}
                      <input
                        type="file"
                        accept={doc.type === "Application Form / Resume" ? "application/pdf,image/*" : undefined}
                        className="hidden"
                        disabled={uploadMutation.isPending}
                        onChange={(e) => handleUpload(doc, e.target.files)}
                      />
                    </label>
                  )}
                  {doc.status === "Submitted" && (
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(doc.id)}
                      disabled={removeMutation.isPending}
                      className="text-xs font-semibold text-critical disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
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

      {license && cpd && (
        <Card>
          <CardHeader title="Professional license" meta={license.licenseType} />
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2.5">
              <div>
                <div className="text-[0.85rem] font-semibold">License No. {license.licenseNumber}</div>
                <div className="text-xs text-ink-2">CPD cycle ends {license.cycleEndDate}</div>
              </div>
              <Chip variant={cpdVariant[cpd.status]}>{cpd.status}</Chip>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-ink-2">
                <span>CPD units</span>
                <span className="font-num font-semibold text-ink">{cpd.note}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{
                    width: `${Math.min(100, Math.round((license.cpdUnitsEarned / license.cpdUnitsRequired) * 100))}%`,
                  }}
                />
              </div>
            </div>
            <Button variant="ghost" className="self-start" onClick={() => setLogCpdOpen(true)}>
              Log CPD units
            </Button>
          </CardBody>
        </Card>
      )}

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

      <LogCpdUnitsDialog
        license={logCpdOpen ? (license ?? null) : null}
        onClose={() => setLogCpdOpen(false)}
        onSubmitted={() => toast.show("CPD units logged.")}
      />
    </>
  );
}
