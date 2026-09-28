import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { GoogleButton } from "@/components/ui/GoogleButton";
import { useToast } from "@/components/ui/ToastContext";
import { CheckIcon, XIcon } from "@/components/icons";
import { registerEmployee } from "@/lib/api";
import { clusterDescriptions, clusterOptions, officeOptions, registerSchema, type RegisterFormValues } from "@/lib/schemas";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";
const errorClass = "mt-1 text-xs font-medium text-critical";

// Demo-only stand-ins for a Google account chooser — this prototype has no
// real OAuth client/backend to exchange tokens with, so "Continue with
// Google" simulates the identity handoff (picking a name/email) rather than
// performing a real sign-in.
const demoGoogleAccounts = [
  { name: "Miguel Torres", email: "miguel.torres@gmail.com" },
  { name: "Sofia Reyes", email: "sofia.reyes@gmail.com" },
];

export function RegisterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [registered, setRegistered] = useState<{ name: string; id: string } | null>(null);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googlePickerOpen, setGooglePickerOpen] = useState(false);
  const [googleAccount, setGoogleAccount] = useState<{ name: string; email: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", position: "", cluster: "RPM", office: "Cebu HQ" },
  });

  const selectedCluster = watch("cluster");

  const mutation = useMutation({
    mutationFn: registerEmployee,
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employee-directory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview-stats"] });
      setRegistered({ name: employee.name, id: employee.id });
      toast.show("Registration submitted. HR will follow up with your access.");
    },
  });

  function close() {
    reset();
    setRegistered(null);
    setGoogleAccount(null);
    setGooglePickerOpen(false);
    onClose();
  }

  function connectGoogle() {
    setGoogleConnecting(true);
    setTimeout(() => {
      setGoogleConnecting(false);
      setGooglePickerOpen(true);
    }, 700);
  }

  function chooseGoogleAccount(account: { name: string; email: string }) {
    setValue("name", account.name, { shouldValidate: true });
    setGoogleAccount(account);
    setGooglePickerOpen(false);
  }

  function disconnectGoogle() {
    setGoogleAccount(null);
    setValue("name", "");
  }

  return (
    <Dialog open={open} onClose={close} title="Register">
      {registered ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-good-tint text-good">
            <CheckIcon className="h-6 w-6" />
          </span>
          <div>
            <div className="font-display text-base font-bold">You're registered, {registered.name}</div>
            <div className="mt-1 text-sm text-ink-2">
              Reference ID <span className="font-num font-semibold">{registered.id}</span>. HR will review your
              details and set up your system access.
            </div>
          </div>
          <Button type="button" onClick={close} className="mt-1">
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-3.5">
          {!googleAccount && (
            <>
              <GoogleButton onClick={connectGoogle} loading={googleConnecting} />

              {googlePickerOpen && (
                <div className="panel-enter rounded-lg border border-border bg-surface-2 p-1.5">
                  <div className="px-2 py-1 text-xs font-semibold text-ink-2">Choose an account</div>
                  {demoGoogleAccounts.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => chooseGoogleAccount(acc)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface"
                    >
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                        {acc.name[0]}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{acc.name}</span>
                        <span className="block truncate text-xs text-ink-2">{acc.email}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2.5 text-xs text-ink-3">
                <span className="h-px flex-1 bg-border" />
                or fill in manually
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          {googleAccount && (
            <div className="flex items-center justify-between gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-ink-2">Connected via Google</div>
                <div className="truncate text-sm font-bold">{googleAccount.email}</div>
              </div>
              <button
                type="button"
                onClick={disconnectGoogle}
                aria-label="Disconnect Google account"
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-ink-2 hover:bg-surface"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div>
            <label htmlFor="reg-name" className={labelClass}>
              Full name
            </label>
            <input
              id="reg-name"
              className={inputClass}
              placeholder="Juan Dela Cruz"
              readOnly={googleAccount !== null}
              {...register("name")}
            />
            {errors.name && <p className={errorClass}>{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="reg-position" className={labelClass}>
              Position
            </label>
            <input
              id="reg-position"
              className={inputClass}
              placeholder="Audit Associate"
              {...register("position")}
            />
            {errors.position && <p className={errorClass}>{errors.position.message}</p>}
          </div>

          <div>
            <span className={labelClass}>Cluster</span>
            <div className="flex flex-col gap-1.5">
              {clusterOptions.map((cluster) => (
                <label
                  key={cluster}
                  className={clsx(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                    selectedCluster === cluster ? "border-brand bg-brand-tint" : "border-border hover:border-brand/50",
                  )}
                >
                  <input type="radio" value={cluster} className="mt-1" {...register("cluster")} />
                  <span>
                    <span className="block text-sm font-bold">{cluster}</span>
                    <span className="block text-xs text-ink-2">{clusterDescriptions[cluster]}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.cluster && <p className={errorClass}>{errors.cluster.message}</p>}
          </div>

          <div>
            <label htmlFor="reg-office" className={labelClass}>
              Office
            </label>
            <select id="reg-office" className={inputClass} {...register("office")}>
              {officeOptions.map((office) => (
                <option key={office} value={office}>
                  {office}
                </option>
              ))}
            </select>
            {errors.office && <p className={errorClass}>{errors.office.message}</p>}
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? "Registering…" : "Register"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
