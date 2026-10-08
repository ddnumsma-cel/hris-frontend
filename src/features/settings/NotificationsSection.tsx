import { SaveBar } from "@/components/ui/SaveBar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingsCard, SettingsHeader, SettingsRow } from "@/components/ui/SettingsCard";
import { Switch } from "@/components/ui/Switch";
import { NOTIFICATION_EVENTS, type Channel, type Digest, type NotificationPrefs } from "@/lib/settings/store";
import { SectionSkeleton } from "./AccountSection";
import { useDraft, useMySettings, useSaveSettings, useUnsavedGuard } from "./useSettings";

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "inApp", label: "In-app" },
  { key: "email", label: "Email" },
];

export function NotificationsSection() {
  const settings = useMySettings();
  const save = useSaveSettings("notifications");
  const { draft, setDraft, dirty, discard } = useDraft<NotificationPrefs>(settings.data?.notifications);
  const guard = useUnsavedGuard(dirty);

  if (!draft) return <SectionSkeleton title="Notifications" />;

  const quietError = draft.quietHours.enabled && draft.quietHours.from === draft.quietHours.to ? "Start and end can't be the same time." : undefined;
  const set = (patch: Partial<NotificationPrefs>) => setDraft({ ...draft, ...patch });
  const setCell = (event: keyof NotificationPrefs["matrix"], channel: Channel, on: boolean) =>
    set({ matrix: { ...draft.matrix, [event]: { ...draft.matrix[event], [channel]: on } } });

  return (
    <>
      <SettingsHeader title="Notifications" description="What you're told about, where, and when to keep things quiet." />

      <SettingsCard>
        <SettingsRow label="Notifications" htmlFor="ntf-on" help="Turn off to stop all alerts, including the bell in the top bar.">
          <Switch id="ntf-on" checked={draft.enabled} onChange={(on) => set({ enabled: on })} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Events" description="Choose how you hear about each kind of update.">
        <div className="overflow-x-auto px-5 py-2">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-4 text-left">
                  Event
                </th>
                {CHANNELS.map((c) => (
                  <th key={c.key} scope="col" className="w-24 px-2 py-2 text-center">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_EVENTS.map((e) => (
                <tr key={e.key} className="border-b border-[var(--line)] last:border-b-0">
                  <th scope="row" className="py-3 pr-4 text-left font-medium normal-case tracking-normal text-[13px] text-ink">
                    {e.label}
                  </th>
                  {CHANNELS.map((c) => (
                    <td key={c.key} className="px-2 py-3 text-center">
                      <span className="inline-flex">
                        <Switch label={`${e.label}: ${c.label}`} checked={draft.matrix[e.key][c.key]} disabled={!draft.enabled} onChange={(on) => setCell(e.key, c.key, on)} />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* TODO(backend): email delivery. Email choices are saved now and used once a mail service is connected. */}
        <p className="px-5 pb-4 text-xs text-ink-2">Email alerts start once HeyHR's email service is connected; your choices are kept until then.</p>
      </SettingsCard>

      <SettingsCard title="Quiet hours" description="No in-app alerts during these hours. They'll be waiting for you afterwards.">
        <SettingsRow label="Use quiet hours" htmlFor="ntf-quiet">
          <Switch id="ntf-quiet" checked={draft.quietHours.enabled} onChange={(on) => set({ quietHours: { ...draft.quietHours, enabled: on } })} />
        </SettingsRow>
        <SettingsRow label="From" htmlFor="ntf-from" error={quietError}>
          <input id="ntf-from" type="time" className="field w-full px-3 py-2 text-sm" disabled={!draft.quietHours.enabled} value={draft.quietHours.from} onChange={(e) => set({ quietHours: { ...draft.quietHours, from: e.target.value } })} />
        </SettingsRow>
        <SettingsRow label="To" htmlFor="ntf-to">
          <input id="ntf-to" type="time" className="field w-full px-3 py-2 text-sm" disabled={!draft.quietHours.enabled} value={draft.quietHours.to} onChange={(e) => set({ quietHours: { ...draft.quietHours, to: e.target.value } })} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Email digest">
        <SettingsRow label="Summary email" help="A roundup of what happened, sent to your work email.">
          <SegmentedControl<Digest>
            label="Summary email"
            value={draft.digest}
            onChange={(digest) => set({ digest })}
            options={[
              { value: "off", label: "Off" },
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <SaveBar visible={dirty} saving={save.isPending} invalid={!!quietError} onDiscard={discard} onSave={() => save.mutate(draft)} />
      {guard}
    </>
  );
}
