import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { AlertTriangleIcon, CheckIcon } from "@/components/icons";
import { applyLink, isAccountingRole } from "@/lib/recruitment";
import type { JobRequisition } from "@/lib/types";

const shareTargets = [
  { name: "Facebook", href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { name: "LinkedIn", href: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  { name: "X", href: (url: string, text: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
];

/**
 * The link HR posts on social media. Anyone who taps it gets the public application form — for one
 * role or for every open role. Accountants are listed and reviewed first.
 */
export function ShareJobLinkDialog({ open, roles, initialRoleId, onClose }: { open: boolean; roles: JobRequisition[]; initialRoleId?: string; onClose: () => void }) {
  return open ? <ShareBody roles={roles} initialRoleId={initialRoleId} onClose={onClose} /> : null;
}

function ShareBody({ roles, initialRoleId, onClose }: { roles: JobRequisition[]; initialRoleId?: string; onClose: () => void }) {
  const toast = useToast();
  const open = roles.filter((r) => r.approval === "Approved" && r.openings > 0);
  const [roleId, setRoleId] = useState(initialRoleId && open.some((r) => r.id === initialRoleId) ? initialRoleId : "");
  const [copied, setCopied] = useState(false);
  const role = open.find((r) => r.id === roleId);
  const url = applyLink(roleId || undefined);
  const text = role ? `We're hiring: ${role.title} at MSMA Group (${role.office}). Apply here:` : "MSMA Group is hiring. See our open roles and apply here:";
  const local = /^https?:\/\/(localhost|127\.|192\.168\.|10\.)/.test(url);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  function copy() {
    // No clipboard API outside https (e.g. a LAN address): select the link so it can be copied by hand.
    if (!navigator.clipboard) {
      document.querySelector<HTMLInputElement>("#share-url")?.select();
      toast.show("Couldn't copy here — the link is selected, press Ctrl+C.");
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        toast.show("Link copied. Paste it in your post.");
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => toast.show("Couldn't copy — select the link and copy it."));
  }

  const accounting = open.filter(isAccountingRole);
  const other = open.filter((r) => !isAccountingRole(r));

  return (
    <Dialog open onClose={onClose} title="Share job link" description="Post it on Facebook, LinkedIn or anywhere; it opens your application form." size="md">
      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="share-role" className="mb-1.5 block text-[0.82rem] font-semibold text-ink-2">
            Link to
          </label>
          <select id="share-role" value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand">
            <option value="">All open roles ({open.length})</option>
            {accounting.length > 0 && (
              <optgroup label="Accounting roles">
                {accounting.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} · {r.office}
                  </option>
                ))}
              </optgroup>
            )}
            {other.length > 0 && (
              <optgroup label="Other roles">
                {other.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} · {r.office}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div>
          <label htmlFor="share-url" className="mb-1.5 block text-[0.82rem] font-semibold text-ink-2">
            Application link
          </label>
          <div className="flex gap-2">
            <input id="share-url" readOnly value={url} onFocus={(e) => e.target.select()} className="font-num min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-ink" />
            <Button onClick={copy} className="flex-none justify-center sm:min-w-24" icon={copied ? <CheckIcon className="h-4 w-4" /> : undefined}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {local && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 flex-none" />
              This link points to this computer. Once the site is published, it will use your public web address.
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-[0.82rem] font-semibold text-ink-2">Share to</p>
          <div className="flex flex-wrap gap-2">
            {shareTargets.map((t) => (
              <a
                key={t.name}
                href={t.href(url, text)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-tint"
              >
                {t.name}
              </a>
            ))}
            {canShare && (
              <button
                type="button"
                onClick={() => navigator.share({ title: role?.title ?? "MSMA Group careers", text, url }).catch(() => {})}
                className="rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-tint"
              >
                More…
              </button>
            )}
          </div>
        </div>

        <a href={url} target="_blank" rel="noreferrer" className="self-start text-xs font-semibold text-brand-ink hover:underline">
          Open the form to check it
        </a>
      </div>
    </Dialog>
  );
}
