'use client';

import {
  type ChecklistItem,
  type ChecklistStatus,
  CHECKLIST_STATUS_LABELS,
  DOC_SECTIONS,
  documentType,
  type EmployeeDocument,
  type File201,
  formatDate,
  formatTime,
  manilaDateKey,
  HANDLING_LABELS,
  MAX_UPLOAD_BYTES,
  SECTION_LABELS,
  suggestedExpiry,
  UPLOAD_MIME_TYPES,
} from '@msma/shared';
import {
  AlertTriangle,
  Check,
  Clock,
  Eye,
  FileText,
  History,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  openDocument,
  useArchiveDocument,
  useDocumentViews,
  useUploadDocument,
} from '@/lib/queries';
import { cn } from '@/lib/utils';
import { useToast } from './toast';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Input, Label, Textarea } from './ui/form';

// ---------- badges ----------

const STATUS_TONE: Record<
  ChecklistStatus,
  'success' | 'warning' | 'danger' | 'neutral' | 'accent'
> = {
  ON_FILE: 'success',
  EXPIRING: 'warning',
  EXPIRED: 'danger',
  MISSING: 'danger',
  NOT_NEEDED: 'neutral',
  NONE_YET: 'neutral',
  AUTOMATIC: 'accent',
};
const STATUS_ICON = {
  ON_FILE: Check,
  EXPIRING: Clock,
  EXPIRED: AlertTriangle,
  MISSING: X,
  NOT_NEEDED: Minus,
  NONE_YET: Minus,
  AUTOMATIC: RefreshCw,
} satisfies Record<ChecklistStatus, unknown>;

export function ChecklistStatusBadge({
  status,
  expiresOn,
}: {
  status: ChecklistStatus;
  expiresOn?: string | null;
}) {
  const Icon = STATUS_ICON[status];
  const label =
    status === 'EXPIRING' && expiresOn
      ? `Expires ${formatDate(expiresOn)}`
      : status === 'EXPIRED' && expiresOn
        ? `Expired ${formatDate(expiresOn)}`
        : CHECKLIST_STATUS_LABELS[status];
  return (
    <Badge tone={STATUS_TONE[status]}>
      <Icon className="size-3" aria-hidden /> {label}
    </Badge>
  );
}

/** "88% complete" with a bar and a plain sentence of what is left. */
export function CompletenessBar({
  percent,
  missing,
  expiring,
  expired,
  compact,
}: {
  percent: number;
  missing: number;
  expiring: number;
  expired: number;
  compact?: boolean;
}) {
  const tone = expired > 0 || missing > 0 ? (percent < 70 ? 'danger' : 'warning') : 'success';
  const parts = [
    missing && `${missing} missing`,
    expired && `${expired} expired`,
    expiring && `${expiring} expiring soon`,
  ].filter(Boolean);
  return (
    <div className={compact ? 'min-w-28' : ''}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn('num font-semibold', compact ? 'text-sm' : 'text-2xl')}>
          {percent}%
        </span>
        {!compact && <span className="text-sm text-muted">complete</span>}
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-border/70"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="201 file complete"
      >
        <div
          className={cn(
            'h-full rounded-full',
            tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : 'bg-danger',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className={cn('mt-1 text-muted', compact ? 'text-xs' : 'text-sm')}>
        {parts.length ? parts.join(' · ') : 'All required documents on file'}
      </p>
    </div>
  );
}

// ---------- checklist ----------

const needsAction = (s: ChecklistStatus) => s === 'MISSING' || s === 'EXPIRED' || s === 'EXPIRING';

function kb(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentLine({
  doc,
  canManage,
  onRemove,
  onHistory,
  showHistory,
}: {
  doc: EmployeeDocument;
  canManage: boolean;
  onRemove: () => void;
  onHistory: () => void;
  showHistory: boolean;
}) {
  const toast = useToast();
  const def = documentType(doc.type);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-bg px-3 py-2 text-sm">
      <FileText className="size-4 shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{doc.referenceNo ?? doc.fileName}</span>
        <span className="block text-xs text-muted">
          {doc.issuedOn ? `Issued ${formatDate(doc.issuedOn)}` : 'No issue date'}
          {def.tracksExpiry &&
            (doc.expiresOn ? ` · valid until ${formatDate(doc.expiresOn)}` : ' · no expiry')}
          {` · added ${formatDate(manilaDateKey(doc.uploadedAt))}`}
          {doc.uploadedBy && ` by ${doc.uploadedBy}`} · {kb(doc.sizeBytes)}
          {doc.notes && ` · ${doc.notes}`}
        </span>
      </span>
      <span className="flex gap-1">
        {doc.canOpen && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => openDocument(doc.id).catch((e: Error) => toast('error', e.message))}
          >
            <Eye /> Open
          </Button>
        )}
        {showHistory && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onHistory}
            aria-label={`Who opened ${def.label}`}
          >
            <History />
          </Button>
        )}
        {canManage && (
          <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${def.label}`}>
            <Trash2 />
          </Button>
        )}
      </span>
    </li>
  );
}

function ChecklistRow({
  item,
  onUpload,
  onRemove,
  onHistory,
  showHistory,
}: {
  item: ChecklistItem;
  onUpload: (item: ChecklistItem) => void;
  onRemove: (doc: EmployeeDocument) => void;
  onHistory: (doc: EmployeeDocument) => void;
  showHistory: boolean;
}) {
  const def = documentType(item.type);
  const restricted = def.access === 'RESTRICTED' || def.access === 'HEALTH';
  const hiddenCount = item.count - item.documents.length;
  const canAdd = item.canManage && (def.multiple || item.count === 0 || def.tracksExpiry);
  return (
    <li
      className={cn(
        'border-t border-border px-4 py-3 first:border-t-0',
        needsAction(item.status) && item.required && 'bg-warning-soft/40',
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {def.label}
            {restricted && (
              <Badge tone="neutral" title="Restricted: only HR can open these records">
                <Lock className="size-3" aria-hidden /> Restricted
              </Badge>
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted">{def.help}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChecklistStatusBadge status={item.status} expiresOn={item.expiresOn} />
          <span className="hidden text-xs text-muted sm:inline">
            {HANDLING_LABELS[def.handling]}
          </span>
          {canAdd && (
            <Button
              size="sm"
              variant={needsAction(item.status) ? 'default' : 'outline'}
              onClick={() => onUpload(item)}
            >
              {item.count === 0 ? (
                <Upload />
              ) : def.tracksExpiry && !def.multiple ? (
                <RefreshCw />
              ) : (
                <Plus />
              )}
              {item.count === 0
                ? 'Upload'
                : def.tracksExpiry && !def.multiple
                  ? 'Upload renewal'
                  : 'Add another'}
            </Button>
          )}
        </div>
      </div>
      {item.documents.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {item.documents.map((d) => (
            <DocumentLine
              key={d.id}
              doc={d}
              canManage={item.canManage}
              onRemove={() => onRemove(d)}
              onHistory={() => onHistory(d)}
              showHistory={showHistory}
            />
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <Lock className="size-3.5" aria-hidden />
          {hiddenCount} document{hiddenCount === 1 ? '' : 's'} on file. Only HR can open{' '}
          {hiddenCount === 1 ? 'it' : 'them'}.
        </p>
      )}
    </li>
  );
}

/** The whole 201 checklist: "needs attention" first, then the five sections of the checklist. */
export function Checklist201({ file, canSeeHistory }: { file: File201; canSeeHistory: boolean }) {
  const [view, setView] = useState<'attention' | 'all'>('attention');
  const [uploading, setUploading] = useState<ChecklistItem | null>(null);
  const [removing, setRemoving] = useState<EmployeeDocument | null>(null);
  const [history, setHistory] = useState<EmployeeDocument | null>(null);

  const attention = file.items.filter((i) => i.required && needsAction(i.status));
  const expiringOptional = file.items.filter((i) => !i.required && needsAction(i.status));
  const shown = view === 'attention' ? [...attention, ...expiringOptional] : null;
  const rowProps = {
    onUpload: setUploading,
    onRemove: setRemoving,
    onHistory: setHistory,
    showHistory: canSeeHistory,
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Show">
        <Button
          size="sm"
          variant={view === 'attention' ? 'default' : 'outline'}
          onClick={() => setView('attention')}
        >
          Needs attention ({attention.length + expiringOptional.length})
        </Button>
        <Button
          size="sm"
          variant={view === 'all' ? 'default' : 'outline'}
          onClick={() => setView('all')}
        >
          Full checklist
        </Button>
      </div>

      {shown ? (
        <Card>
          {shown.length === 0 ? (
            <p className="flex items-center gap-2 p-5 text-sm text-success">
              <Check className="size-4" aria-hidden /> Nothing to do. Every required document is on
              file and valid.
            </p>
          ) : (
            <ul>
              {shown.map((i) => (
                <ChecklistRow key={i.type} item={i} {...rowProps} />
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {DOC_SECTIONS.map((section) => {
            const items = file.items.filter((i) => documentType(i.type).section === section);
            if (section === 'SEPARATION' && !file.employee.separationDate)
              return (
                <Card key={section} className="p-4">
                  <h3 className="font-semibold">{SECTION_LABELS[section]}</h3>
                  <p className="mt-1 text-sm text-muted">
                    Only needed when the employee leaves (resignation letter, clearance, final pay,
                    COE, BIR 2316).
                  </p>
                </Card>
              );
            return (
              <Card key={section}>
                <h3 className="border-b border-border px-4 py-3 font-semibold">
                  {SECTION_LABELS[section]}
                </h3>
                <ul>
                  {items.map((i) => (
                    <ChecklistRow key={i.type} item={i} {...rowProps} />
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Retention periods are sample values to be confirmed with the Firm. Removed documents are
        kept in the archive; nothing is permanently deleted from here.
      </p>

      <UploadDialog employee={file.employee} item={uploading} onClose={() => setUploading(null)} />
      <RemoveDialog
        employeeName={file.employee.fullName}
        doc={removing}
        onClose={() => setRemoving(null)}
      />
      <HistoryDialog doc={history} onClose={() => setHistory(null)} />
    </>
  );
}

// ---------- dialogs ----------

const ACCEPT = UPLOAD_MIME_TYPES.join(',');

function whoCanOpen(access: ReturnType<typeof documentType>['access']) {
  switch (access) {
    case 'RESTRICTED':
    case 'HEALTH':
      return 'Only HR will be able to open it. Every opening is recorded.';
    case 'PERFORMANCE':
      return 'HR, the employee and their direct manager will be able to open it.';
    case 'PAYROLL':
      return 'HR, Payroll and the employee will be able to open it.';
    default:
      return 'HR and the employee will be able to open it.';
  }
}

function UploadDialog({
  employee,
  item,
  onClose,
}: {
  employee: File201['employee'];
  item: ChecklistItem | null;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [issuedOn, setIssuedOn] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument();
  const toast = useToast();

  useEffect(() => {
    setFile(null);
    setIssuedOn('');
    setExpiresOn('');
    setExpiryTouched(false);
    setReferenceNo('');
    setNotes('');
    setError(null);
  }, [item]);

  if (!item) return null;
  const def = documentType(item.type);
  const suggestion = def.tracksExpiry && issuedOn ? suggestedExpiry(def.code, issuedOn) : null;
  const effectiveExpiry = expiryTouched ? expiresOn : (suggestion ?? expiresOn);

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!(UPLOAD_MIME_TYPES as readonly string[]).includes(f.type))
      return setError('Choose a PDF, JPG or PNG file (a scan or a phone photo).');
    if (f.size > MAX_UPLOAD_BYTES)
      return setError('The file is larger than 8 MB. Scan it at a lower resolution.');
    setFile(f);
  }

  function save() {
    if (!file || !item) return;
    upload.mutate(
      {
        employeeId: employee.id,
        file,
        type: item.type,
        issuedOn: issuedOn || null,
        expiresOn: def.tracksExpiry ? effectiveExpiry || null : null,
        referenceNo: referenceNo.trim() || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast('success', `${def.label} added to ${employee.fullName}'s 201 file.`);
          onClose();
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Add {def.label.toLowerCase()}</DialogTitle>
        <DialogDescription>
          For {employee.fullName}&apos;s 201 file. {whoCanOpen(def.access)}
        </DialogDescription>

        <div
          className={cn(
            'mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-4 py-6 text-center text-sm hover:bg-bg',
            file && 'border-success bg-success-soft/40',
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
        >
          {file ? (
            <>
              <FileText className="mb-1 size-6 text-success" aria-hidden />
              <span className="font-medium">{file.name}</span>
              <span className="text-xs text-muted">{kb(file.size)} · click to choose another</span>
            </>
          ) : (
            <>
              <Upload className="mb-1 size-6 text-muted" aria-hidden />
              <span className="font-medium">Click to choose the scanned file, or drag it here</span>
              <span className="text-xs text-muted">PDF, JPG or PNG, up to 8 MB</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="File to upload"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="doc-issued">Date issued / signed</Label>
            <Input
              id="doc-issued"
              type="date"
              value={issuedOn}
              onChange={(e) => setIssuedOn(e.target.value)}
            />
          </div>
          {def.tracksExpiry && (
            <div>
              <Label htmlFor="doc-expires">Valid until</Label>
              <Input
                id="doc-expires"
                type="date"
                value={effectiveExpiry}
                onChange={(e) => {
                  setExpiryTouched(true);
                  setExpiresOn(e.target.value);
                }}
              />
              {suggestion && !expiryTouched && (
                <p className="mt-1 text-xs text-muted">
                  Filled in from the usual validity ({def.validityMonths} months). Change it if the
                  document says otherwise.
                </p>
              )}
            </div>
          )}
          {def.referenceLabel && (
            <div className="sm:col-span-2">
              <Label htmlFor="doc-ref">{def.referenceLabel}</Label>
              <Input
                id="doc-ref"
                value={referenceNo}
                maxLength={120}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label htmlFor="doc-notes">Note (optional)</Label>
            <Textarea
              id="doc-notes"
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!file || upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Save to 201 file'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({
  employeeName,
  doc,
  onClose,
}: {
  employeeName: string;
  doc: EmployeeDocument | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const archive = useArchiveDocument();
  const toast = useToast();
  useEffect(() => setReason(''), [doc]);
  if (!doc) return null;
  const def = documentType(doc.type);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>Remove this {def.label.toLowerCase()}?</DialogTitle>
        <DialogDescription>{doc.referenceNo ?? doc.fileName}</DialogDescription>
        <p className="mt-3 rounded-md bg-bg px-3 py-2 text-sm">
          It will no longer appear in {employeeName}&apos;s 201 file. The file is not deleted: it is
          kept in the archive with your reason, for the retention period.
        </p>
        <div className="mt-4">
          <Label htmlFor="remove-reason">Reason (required)</Label>
          <Textarea
            id="remove-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Uploaded to the wrong employee"
            maxLength={500}
            autoFocus
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={archive.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 5 || archive.isPending}
            onClick={() =>
              archive.mutate(
                { id: doc.id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast('success', `${def.label} removed from the 201 file.`);
                    onClose();
                  },
                  onError: (e) => toast('error', e.message),
                },
              )
            }
          >
            {archive.isPending ? 'Removing…' : 'Remove document'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ACTION_LABELS: Record<string, string> = {
  DOCUMENT_UPLOADED: 'Uploaded',
  DOCUMENT_OPENED: 'Opened',
  DOCUMENT_UPDATED: 'Changed',
  DOCUMENT_ARCHIVED: 'Removed',
};

function HistoryDialog({ doc, onClose }: { doc: EmployeeDocument | null; onClose: () => void }) {
  const views = useDocumentViews(doc?.id ?? null);
  if (!doc) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>Who opened this document</DialogTitle>
        <DialogDescription>
          {documentType(doc.type).label} · {doc.referenceNo ?? doc.fileName}
        </DialogDescription>
        <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto text-sm">
          {views.isLoading && <li className="text-muted">Loading…</li>}
          {views.data?.items.map((v, i) => (
            <li
              key={i}
              className="flex justify-between gap-3 border-b border-border py-1.5 last:border-0"
            >
              <span>
                <span className="font-medium">{ACTION_LABELS[v.action] ?? v.action}</span> by {v.by}
              </span>
              <span className="num text-muted">
                {formatDate(manilaDateKey(v.at))} {formatTime(v.at)}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
