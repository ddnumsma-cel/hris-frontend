import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { LockIcon } from "@/components/icons";
import { ProfileSettingsForm, settingsInputClass, settingsLabelClass } from "@/components/shared/ProfileSettingsForm";
import { changeAdminCredentials, fetchAdminProfile, updateAdminProfile } from "@/lib/api";
import { getCredential } from "@/lib/credentials";

const MIN_PASSWORD_LENGTH = 6;

function CredentialsForm() {
  const toast = useToast();
  const [username, setUsername] = useState(() => getCredential("admin").username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: changeAdminCredentials,
    onSuccess: ({ username: saved }) => {
      setUsername(saved);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.show("Sign-in credentials updated. Use them the next time you log in.");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Couldn't update your credentials."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[a-z0-9._-]{3,}$/i.test(username.trim())) {
      setError("Username must be at least 3 characters: letters, numbers, dots, dashes or underscores.");
      return;
    }
    if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    mutation.mutate({ currentPassword, username, newPassword: newPassword || undefined });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader title="Sign-in credentials" meta="Your current password is required to save changes" />
        <CardBody className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="cred-username" className={settingsLabelClass}>
                Username
              </label>
              <input
                id="cred-username"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={settingsInputClass}
              />
            </div>
            <div>
              <label htmlFor="cred-current" className={settingsLabelClass}>
                Current password
              </label>
              <input
                id="cred-current"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={settingsInputClass}
              />
            </div>
            <div>
              <label htmlFor="cred-new" className={settingsLabelClass}>
                New password <span className="font-normal text-ink-3">(leave blank to keep)</span>
              </label>
              <input
                id="cred-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={settingsInputClass}
              />
            </div>
            <div>
              <label htmlFor="cred-confirm" className={settingsLabelClass}>
                Confirm new password
              </label>
              <input
                id="cred-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={settingsInputClass}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-critical-tint px-3 py-2 text-xs font-semibold text-critical">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" icon={<LockIcon className="h-3.5 w-3.5" />} disabled={mutation.isPending}>
              {mutation.isPending ? "Updating…" : "Update credentials"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

export function AdminSettings() {
  const profileQuery = useQuery({ queryKey: ["admin", "profile"], queryFn: fetchAdminProfile });

  return (
    <>
      <ContentHead title="Settings" subtitle="Your HR profile, contact information and sign-in credentials" />
      {profileQuery.data ? (
        <ProfileSettingsForm
          profile={profileQuery.data}
          save={updateAdminProfile}
          queryKey={["admin", "profile"]}
          personalMeta="Shown in the top bar, the org chart and on cases you file"
          aboutPlaceholder="HR focus areas, certifications, anything employees should know"
        />
      ) : (
        <Card className="p-4">
          <Skeleton className="h-40 w-full" />
        </Card>
      )}
      <CredentialsForm />
    </>
  );
}
