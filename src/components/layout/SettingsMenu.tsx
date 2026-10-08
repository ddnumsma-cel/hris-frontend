// The top bar's gear menu: who's signed in, quick settings that apply and save at once
// (theme, notifications, compact density), links into Settings, and Log out.
// Esc or an outside click closes it; TopBar then returns focus to the gear.

import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { useAuth } from "@/features/auth/AuthContext";
import { useSettingsAreas } from "@/features/settings/SettingsLayout";
import { useMySettings, useSaveSettings } from "@/features/settings/useSettings";
import { fetchMyAvatar, fetchMyProfile } from "@/lib/settings/api";
import { settingsKeyFor, type ThemePreference } from "@/lib/settings/store";
import { getThemePreference, setThemePreference } from "@/lib/theme";
import { useThemePreference } from "@/lib/useTheme";

const WORKSPACE = { admin: "HR workspace", manager: "Partner workspace", employee: "Employee workspace" } as const;
const sectionLabel = "px-5 pb-2 text-[10.5px] font-semibold tracking-[0.1em] text-[var(--nav-label)] uppercase";
const linkClass = "flex min-h-9 items-center rounded-[var(--radius-control)] px-3 text-[13.5px] text-[var(--text)] transition-colors hover:bg-[var(--nav-hover-bg)]";

export function SettingsMenu({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const { user } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);
  const settings = useMySettings();
  const saveNotifications = useSaveSettings("notifications", { quiet: true });
  const saveAppearance = useSaveSettings("appearance", { quiet: true });
  const theme = useThemePreference();
  const areas = useSettingsAreas();
  const key = user ? settingsKeyFor(user) : "none";
  const profile = useQuery({ queryKey: ["settings", "profile", key], queryFn: () => fetchMyProfile(user!), enabled: !!user });
  const avatar = useQuery({ queryKey: ["settings", "avatar", key], queryFn: () => fetchMyAvatar(user!), enabled: !!user });
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus moves into the menu; Esc closes it.
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("[role=radio][aria-checked=true], button, a")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!user) return null;
  const s = settings.data;
  const name = s?.account.displayName.trim() || user.name;
  const base = `/${user.role}/settings`;

  const chooseTheme = (t: ThemePreference) => {
    setThemePreference(t);
    if (s) saveAppearance.mutate({ ...s.appearance, theme: t });
  };

  return (
    <div ref={panelRef} role="dialog" aria-label="Settings" className="glass-surface panel-enter absolute top-full right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[var(--radius-dropdown)]">
      {/* Who's signed in */}
      <div className="flex items-center gap-3 border-b border-[var(--line-strong)] px-5 py-4">
        {avatar.data ? (
          <img src={avatar.data} alt="" className="h-10 w-10 flex-none rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="topbar-avatar flex h-10 w-10 flex-none items-center justify-center rounded-full text-[13px]">
            {user.initials}
          </span>
        )}
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold text-ink">{name}</div>
          <div className="truncate text-xs text-ink-2">
            {user.title} · {WORKSPACE[user.role]}
          </div>
          {profile.data?.email && <div className="truncate text-xs text-ink-2">{profile.data.email}</div>}
        </div>
      </div>

      {/* Quick settings: apply and save immediately */}
      <div className="flex flex-col gap-1 pt-4 pb-3">
        <h3 className={sectionLabel}>Quick settings</h3>
        <div className="flex min-h-10 items-center justify-between gap-4 px-5">
          <span className="text-[13.5px] text-ink">Theme</span>
          <SegmentedControl<ThemePreference>
            label="Theme"
            size="sm"
            value={theme}
            onChange={chooseTheme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
        </div>
        <div className="flex min-h-10 items-center justify-between gap-4 px-5">
          <label htmlFor="quick-notifications" className="text-[13.5px] text-ink">
            Notifications
          </label>
          <Switch
            id="quick-notifications"
            checked={s?.notifications.enabled ?? true}
            disabled={!s || saveNotifications.isPending}
            onChange={(on) => s && saveNotifications.mutate({ ...s.notifications, enabled: on })}
          />
        </div>
        <div className="flex min-h-10 items-center justify-between gap-4 px-5">
          <label htmlFor="quick-density" className="text-[13.5px] text-ink">
            Compact density
          </label>
          <Switch
            id="quick-density"
            checked={s?.appearance.density === "compact"}
            disabled={!s || saveAppearance.isPending}
            onChange={(on) => s && saveAppearance.mutate({ ...s.appearance, theme: getThemePreference(), density: on ? "compact" : "comfortable" })}
          />
        </div>
      </div>

      {/* Into Settings */}
      <nav aria-label="Settings pages" className="flex flex-col border-t border-[var(--line-strong)] px-2 py-2">
        <Link to={`${base}/account`} onClick={onClose} className={linkClass}>
          My account
        </Link>
        {/* HR and Admin each have their own settings; employees only have their own. */}
        {areas.slice(1).map((a) => (
          <Link key={a.key} to={`${base}/${a.items[0]!.path}`} onClick={onClose} className={linkClass}>
            {a.label}
          </Link>
        ))}
        <Link to={base} onClick={onClose} className={linkClass}>
          All settings
        </Link>
      </nav>

      <div className="flex items-center justify-between gap-4 border-t border-[var(--line-strong)] px-5 py-3 text-[13px]">
        <span className="min-w-0 truncate text-ink-2">
          Signed in as <span className="font-medium text-ink">{name}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="flex-none rounded-[var(--radius-control)] px-2 py-1 font-medium text-critical hover:bg-critical-tint"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
