import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { getSettings, saveSettings } from "@/lib/admin/api";
import type { Settings } from "@/lib/admin/store";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError } from "../corehr/ui";

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-ink-2">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Form({ initial }: { initial: Settings }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [s, setS] = useState(initial);
  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });
  const num = (k: keyof Settings) => ({ type: "number", className: inputClass, value: s[k] as number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [k]: e.target.valueAsNumber } as Partial<Settings>) });
  const save = useMutation({
    mutationFn: () => saveSettings(s, actor),
    onSuccess: (next) => {
      queryClient.setQueryData(["admin", "settings"], next);
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
      toast.show("Settings saved.");
    },
  });
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Company" hint="Shown on printed reports and documents.">
          <Field id="s-name" label="Company name" required>
            <input id="s-name" className={inputClass} value={s.companyName} onChange={(e) => set({ companyName: e.target.value })} />
          </Field>
          <Field id="s-tin" label="Company TIN">
            <input id="s-tin" className={inputClass} placeholder="000-000-000-00000" value={s.tin} onChange={(e) => set({ tin: e.target.value })} />
          </Field>
          <Field id="s-addr" label="Address">
            <input id="s-addr" className={inputClass} value={s.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field id="s-mail" label="HR email" hint="Where employees send questions.">
            <input id="s-mail" type="email" className={inputClass} value={s.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
          </Field>
        </Section>
        <Section title="Sign-in security" hint="Applies to every account. Changes take effect at the next sign-in.">
          <Field id="s-len" label="Minimum password length" hint="At least 8. Used for new and reset passwords.">
            <input id="s-len" min={8} max={64} {...num("minPasswordLength")} />
          </Field>
          <Field id="s-idle" label="Sign out after inactivity (minutes)" hint="Protects shared or unattended computers.">
            <input id="s-idle" min={5} max={480} {...num("idleMinutes")} />
          </Field>
          <Field id="s-fail" label="Lock after this many wrong passwords">
            <input id="s-fail" min={3} max={10} {...num("lockAfterFailed")} />
          </Field>
          <Field id="s-lock" label="Keep it locked for (minutes)" hint="HR can unlock sooner from Users.">
            <input id="s-lock" min={5} max={1440} {...num("lockMinutes")} />
          </Field>
        </Section>
      </div>
      <div className="flex items-center justify-end gap-3">
        <ErrorNote error={save.error} />
        <Button variant="ghost" disabled={!dirty} onClick={() => setS(initial)}>
          Undo changes
        </Button>
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          Save settings
        </Button>
      </div>
    </>
  );
}

export function SystemSettingsPage() {
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: getSettings });
  if (settings.isError) return <LoadError onRetry={() => settings.refetch()} />;
  return (
    <>
      <ContentHead title="System settings" subtitle="Company details and sign-in security for everyone who uses the system. Time zone: Philippines (UTC+8)." />
      {settings.data ? <Form key={JSON.stringify(settings.data)} initial={settings.data} /> : <Skeleton className="h-72 w-full" />}
    </>
  );
}
