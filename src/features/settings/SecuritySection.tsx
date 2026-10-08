import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { SettingsCard, SettingsHeader, SettingsRow } from "@/components/ui/SettingsCard";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/features/auth/AuthContext";
import { fmtDate, fmtTime } from "@/lib/preferences";
import { changeMyPassword, fetchMySessions, minPasswordLength, passwordStrength, signOutOtherSessions } from "@/lib/settings/api";
import { settingsKeyFor } from "@/lib/settings/store";
import { SectionSkeleton } from "./AccountSection";
import { useMySettings, useSaveSettings, useUnsavedGuard } from "./useSettings";

const inputClass = "field w-full px-3 py-2 text-sm";
const METER = ["bg-[var(--danger)]", "bg-[var(--danger)]", "bg-[var(--warning)]", "bg-[var(--sky)]", "bg-[var(--success)]"];

export function SecuritySection() {
  const { user } = useAuth();
  const toast = useToast();
  const settings = useMySettings();
  const saveSecurity = useSaveSettings("security");
  const sessions = useQuery({ queryKey: ["settings", "sessions", user ? settingsKeyFor(user) : "none"], queryFn: () => fetchMySessions(user!), enabled: !!user });

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [tried, setTried] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const typing = !!(pw.current || pw.next || pw.confirm);
  const guard = useUnsavedGuard(typing);

  const changePassword = useMutation({
    mutationFn: () => changeMyPassword(user!, pw.current, pw.next),
    onSuccess: () => {
      setPw({ current: "", next: "", confirm: "" });
      setTried(false);
      toast.show("Password updated. Use it the next time you sign in.");
    },
    onError: (e: Error) => toast.show(e.message, "critical"),
  });
  const revoke = useMutation({
    mutationFn: () => signOutOtherSessions(user!),
    onSuccess: () => {
      setRevokeOpen(false);
      // TODO(backend): with real sessions this signs other devices out; today there are none to end.
      toast.show("Other sessions signed out. This device stays signed in.");
    },
  });

  if (!settings.data) return <SectionSkeleton title="Security" />;

  const min = minPasswordLength();
  const strength = passwordStrength(pw.next);
  const errors = {
    current: !pw.current ? "Enter your current password." : undefined,
    next: pw.next.length < min ? `Use at least ${min} characters.` : pw.next === pw.current ? "Choose a password you haven't been using." : undefined,
    confirm: pw.confirm !== pw.next ? "The two new passwords don't match." : undefined,
  };
  const invalid = !!(errors.current || errors.next || errors.confirm);
  const show = (k: keyof typeof errors) => (tried ? errors[k] : undefined);
  const twoFactor = settings.data.security.twoFactor;

  return (
    <>
      <SettingsHeader title="Security" description="Your password, two-step sign-in, and where you're signed in." />

      <SettingsCard title="Change password" description={`At least ${min} characters. Mixing upper and lower case, numbers and symbols makes it stronger.`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (!invalid) changePassword.mutate();
          }}
        >
          <SettingsRow label="Current password" htmlFor="pw-current" error={show("current")}>
            <input id="pw-current" type="password" autoComplete="current-password" className={inputClass} value={pw.current} aria-invalid={!!show("current")} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </SettingsRow>
          <SettingsRow label="New password" htmlFor="pw-next" error={show("next")}>
            <div className="flex flex-col gap-2">
              <input id="pw-next" type="password" autoComplete="new-password" className={inputClass} value={pw.next} aria-invalid={!!show("next")} aria-describedby="pw-strength" onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              <div className="flex items-center gap-2" id="pw-strength">
                <div aria-hidden="true" className="grid flex-1 grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} className={clsx("h-1.5 rounded-full", pw.next && strength.score >= i ? METER[strength.score] : "bg-[var(--tint)]")} />
                  ))}
                </div>
                <span className="w-16 flex-none text-left text-xs text-ink-2">{pw.next ? strength.label : ""}</span>
              </div>
            </div>
          </SettingsRow>
          <SettingsRow label="Confirm new password" htmlFor="pw-confirm" error={show("confirm")}>
            <input id="pw-confirm" type="password" autoComplete="new-password" className={inputClass} value={pw.confirm} aria-invalid={!!show("confirm")} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </SettingsRow>
          <div className="flex justify-end gap-2 px-5 py-4">
            {typing && (
              <Button type="button" variant="ghost" onClick={() => (setPw({ current: "", next: "", confirm: "" }), setTried(false))}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={changePassword.isPending || (tried && invalid) || !typing}>
              {changePassword.isPending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </SettingsCard>

      <SettingsCard title="Two-step sign-in">
        <SettingsRow label="Two-factor authentication" htmlFor="sec-2fa" help="Ask for a code from an authenticator app after your password.">
          <Switch id="sec-2fa" checked={twoFactor} disabled={saveSecurity.isPending} onChange={(on) => (on ? setSetupOpen(true) : setDisableOpen(true))} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Active sessions" description="Devices where you're signed in to HeyHR.">
        {sessions.data?.map((s) => (
          <SettingsRow key={s.id} label={s.device} help={s.signedInAt ? `Signed in ${fmtDate(s.signedInAt)} at ${fmtTime(s.signedInAt)}` : "Signed in"}>
            {s.current && <span className="inline-flex rounded-[var(--radius-pill)] bg-good-tint px-2.5 py-[3px] text-[11px] font-medium text-good">This device</span>}
          </SettingsRow>
        ))}
        <div className="flex justify-end px-5 py-4">
          <Button variant="danger" onClick={() => setRevokeOpen(true)}>
            Sign out of other sessions
          </Button>
        </div>
      </SettingsCard>

      {/* TODO(backend): real two-factor enrolment (secret, QR code, verifying a code) and enforcing it at sign-in. */}
      <Dialog
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        title="Set up two-factor authentication"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSetupOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={saveSecurity.isPending}
              onClick={() => saveSecurity.mutate({ ...settings.data!.security, twoFactor: true }, { onSuccess: () => setSetupOpen(false) })}
            >
              Turn on
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 text-sm text-ink-2">
          <p>Scan a QR code with an authenticator app, then enter the 6-digit code it shows.</p>
          <div className="flex h-36 items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--line-strong)] bg-[var(--tint)] text-center text-xs text-ink-2">
            QR code setup isn't available yet.
            <br />
            Your choice is saved, but sign-in won't ask for a code until it is.
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={disableOpen}
        title="Turn off two-factor authentication?"
        message="Signing in will only need your password, which makes your account easier to break into."
        confirmLabel="Turn off"
        pendingLabel="Turning off…"
        isPending={saveSecurity.isPending}
        onConfirm={() => saveSecurity.mutate({ ...settings.data!.security, twoFactor: false }, { onSuccess: () => setDisableOpen(false) })}
        onClose={() => setDisableOpen(false)}
      />
      <ConfirmDialog
        open={revokeOpen}
        title="Sign out of other sessions?"
        message="Every other device signed in to your account will be signed out. This device stays signed in."
        confirmLabel="Sign out others"
        pendingLabel="Signing out…"
        isPending={revoke.isPending}
        onConfirm={() => revoke.mutate()}
        onClose={() => setRevokeOpen(false)}
      />
      {guard}
    </>
  );
}
