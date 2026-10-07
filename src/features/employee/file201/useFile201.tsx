import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/ToastContext";
import type { ChipVariant } from "@/components/ui/Chip";
import { LogCpdUnitsDialog } from "@/components/shared/LogCpdUnitsDialog";
import {
  enrollFaceId,
  fetchCurrentEmployee,
  fetchMyAssets,
  fetchMyPersonnelChecklist,
  fetchMyPhoto,
  fetchMyProfessionalLicense,
  removeMyPersonnelDocument,
  updateMyPhoto,
  uploadMyPersonnelDocument,
} from "@/lib/api";
import { getCpdStatus } from "@/lib/automation";
import { saveFile } from "@/lib/fileStore";
import type { CpdStatus, PersonnelDocumentChecklistItem } from "@/lib/types";
import { EditProfileDialog } from "../EditProfileDialog";
import { FaceScanDialog } from "../FaceScanDialog";
import { print201File } from "../printTemplates";

/** One required document, worded for the employee. */
export interface DocRow {
  item: PersonnelDocumentChecklistItem;
  label: string;
  tone: ChipVariant;
  meta: string;
  needsAction: boolean;
  /** "Upload", "Replace" or "Upload new"; none when HR has it locked. */
  uploadLabel?: string;
  canRemove: boolean;
  accept?: string;
}

export const cpdTone: Record<CpdStatus, ChipVariant> = { Compliant: "good", "In progress": "neutral", "Due soon": "warn", Overdue: "crit" };

export const linkClass = "inline-flex items-center gap-1 text-xs font-semibold text-brand-ink hover:underline";

export const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

function toRow(item: PersonnelDocumentChecklistItem): DocRow {
  const accept = item.type === "Application Form / Resume" ? "application/pdf,image/*" : undefined;
  if (item.expiry) {
    const expired = item.expiry.status === "Overdue";
    return { item, label: expired ? "Expired" : "Expires soon", tone: expired ? "crit" : "warn", meta: item.expiry.note, needsAction: true, uploadLabel: "Upload new", canRemove: false, accept };
  }
  if (item.status === "Missing") return { item, label: "Missing", tone: "warn", meta: "Not submitted yet", needsAction: true, uploadLabel: "Upload", canRemove: false, accept };
  if (item.status === "Verified") return { item, label: "Verified", tone: "good", meta: "Checked by HR", needsAction: false, canRemove: false };
  return {
    item,
    label: "Submitted",
    tone: "neutral",
    meta: item.uploadedOn ? `Uploaded ${shortDate(item.uploadedOn)} · waiting for HR` : "Waiting for HR to verify",
    needsAction: false,
    uploadLabel: "Replace",
    canRemove: true,
    accept,
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Everything the 201 File shows and does, shared by every layout. */
export function useFile201() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);
  const [cpdOpen, setCpdOpen] = useState(false);
  const employeeQuery = useQuery({ queryKey: ["employee", "me"], queryFn: fetchCurrentEmployee });
  const assetsQuery = useQuery({ queryKey: ["employee", "my-assets"], queryFn: fetchMyAssets });
  const licenseQuery = useQuery({ queryKey: ["employee", "professional-license"], queryFn: fetchMyProfessionalLicense });
  const checklistQuery = useQuery({ queryKey: ["employee", "personnel-checklist"], queryFn: fetchMyPersonnelChecklist });
  const photoQuery = useQuery({ queryKey: ["employee", "my-photo"], queryFn: fetchMyPhoto });
  const employee = employeeQuery.data;
  const license = licenseQuery.data;
  const cpd = license ? getCpdStatus(license) : null;

  const enroll = useMutation({
    mutationFn: enrollFaceId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "me"] });
      setFaceOpen(false);
      toast.show("Face ID enrolled. You can now clock in remotely with a face scan.");
    },
  });
  const upload = useMutation({
    mutationFn: ({ id, fileName }: { id: string; fileName: string }) => uploadMyPersonnelDocument(id, fileName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "personnel-checklist"] });
      toast.show("Document uploaded — HR will verify it shortly.");
    },
  });
  const photo = useMutation({
    mutationFn: updateMyPhoto,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", "my-photo"] }),
  });
  const remove = useMutation({
    mutationFn: removeMyPersonnelDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "personnel-checklist"] });
      toast.show("Upload removed — you can submit it again.");
    },
  });

  async function pickFile(row: DocRow, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    // Keep the file itself so HR can open it later.
    await saveFile(row.item.id, file);
    upload.mutate({ id: row.item.id, fileName: file.name });
    if (row.item.type === "Application Form / Resume" && file.type.startsWith("image/")) photo.mutate(await readAsDataUrl(file));
  }

  const docs = (checklistQuery.data ?? []).filter((d) => d.status !== "Not applicable").map(toRow);
  // Urgent first: expired, then missing, then the rest in HR's order.
  const rank = (r: DocRow) => (r.tone === "crit" ? 0 : r.needsAction ? 1 : 2);
  const sortedDocs = [...docs].sort((a, b) => rank(a) - rank(b));
  const onFile = docs.filter((d) => d.item.status !== "Missing").length;
  const verified = docs.filter((d) => d.item.status === "Verified").length;

  const dialogs: ReactNode = (
    <>
      <EditProfileDialog open={editOpen} employee={employee ?? null} onClose={() => setEditOpen(false)} onSubmitted={() => toast.show("Your profile has been updated.")} />
      <FaceScanDialog open={faceOpen} mode="enroll" onClose={() => setFaceOpen(false)} onSuccess={() => enroll.mutate()} />
      <LogCpdUnitsDialog license={cpdOpen ? (license ?? null) : null} onClose={() => setCpdOpen(false)} onSubmitted={() => toast.show("CPD units logged.")} />
    </>
  );

  return {
    employee,
    photo: photoQuery.data,
    assets: assetsQuery.data,
    license,
    cpd,
    docs: sortedDocs,
    docsLoading: checklistQuery.isLoading,
    onFile,
    verified,
    busy: upload.isPending || remove.isPending,
    pickFile,
    removeDoc: (row: DocRow) => remove.mutate(row.item.id),
    editProfile: () => setEditOpen(true),
    enrollFace: () => setFaceOpen(true),
    logCpd: () => setCpdOpen(true),
    print: () => employee && print201File(employee),
    dialogs,
  };
}

export type File201 = ReturnType<typeof useFile201>;
