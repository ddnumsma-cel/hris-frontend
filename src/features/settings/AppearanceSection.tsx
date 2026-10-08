import { useMemo } from "react";
import { SaveBar } from "@/components/ui/SaveBar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingsCard, SettingsHeader, SettingsRow } from "@/components/ui/SettingsCard";
import { Switch } from "@/components/ui/Switch";
import { useAuth } from "@/features/auth/AuthContext";
import { usePageAllowed } from "@/features/admin/administration/access";
import type { AppearancePrefs, Density, ThemePreference } from "@/lib/settings/store";
import { useThemePreference } from "@/lib/useTheme";
import { SectionSkeleton } from "./AccountSection";
import { LANDING_OPTIONS } from "./landing";
import { useDraft, useMySettings, useSaveSettings, useUnsavedGuard } from "./useSettings";

export function AppearanceSection() {
  const { user } = useAuth();
  const allowed = usePageAllowed();
  const settings = useMySettings();
  const save = useSaveSettings("appearance");
  // The theme is per device (shared with the moon toggle); the rest comes from saved settings.
  const theme = useThemePreference();
  const saved = useMemo(() => (settings.data ? { ...settings.data.appearance, theme } : undefined), [settings.data, theme]);
  const { draft, setDraft, dirty, discard } = useDraft<AppearancePrefs>(saved);
  const guard = useUnsavedGuard(dirty);

  if (!draft || !user) return <SectionSkeleton title="Appearance" />;
  const set = (patch: Partial<AppearancePrefs>) => setDraft({ ...draft, ...patch });
  // Only pages this person can open.
  const landing = LANDING_OPTIONS[user.role].filter((o) => !o.value || allowed(o.value));

  return (
    <>
      <SettingsHeader title="Appearance" description="How HeyHR looks and moves for you." />

      <SettingsCard>
        <SettingsRow label="Theme" help="System follows your device's light or dark setting.">
          <SegmentedControl<ThemePreference>
            label="Theme"
            value={draft.theme}
            onChange={(t) => set({ theme: t })}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Density" help="Compact fits more rows on screen with tighter spacing.">
          <SegmentedControl<Density>
            label="Density"
            value={draft.density}
            onChange={(d) => set({ density: d })}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Reduce motion" htmlFor="app-motion" help="Turns off animations and sliding panels. Your device setting is respected too.">
          <Switch id="app-motion" checked={draft.reduceMotion} onChange={(on) => set({ reduceMotion: on })} />
        </SettingsRow>
        <SettingsRow label="Default landing page" htmlFor="app-landing" help="The page that opens after you sign in.">
          <select id="app-landing" className="field w-full px-3 py-2 text-sm" value={draft.landing} onChange={(e) => set({ landing: e.target.value })}>
            {landing.map((o) => (
              <option key={o.value || "home"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingsCard>

      <SaveBar visible={dirty} saving={save.isPending} invalid={false} onDiscard={discard} onSave={() => save.mutate(draft)} />
      {guard}
    </>
  );
}
