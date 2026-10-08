import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useAuth } from "@/features/auth/AuthContext";
import { hasHrAccess } from "@/lib/admin/auth";
import { useOfficeFilter, type OfficeFilter } from "@/features/admin/OfficeFilterContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { fetchAnnouncements, fetchMyPhoto } from "@/lib/api";
import { BellIcon, BuildingIcon, CheckIcon, ChevronDownIcon, LogOutIcon, SearchIcon, SettingsIcon } from "../icons";
import { BrandName, WorkspaceLabel } from "./Brand";
import { SettingsMenu } from "./SettingsMenu";
import { useMySettings } from "@/features/settings/useSettings";
import { fetchMyAvatar } from "@/lib/settings/api";
import { settingsKeyFor } from "@/lib/settings/store";

const offices: OfficeFilter[] = ["All offices", "Cebu HQ", "Manila", "Davao"];

/** Shortcut hint for the search box: ⌘ K on Apple devices, Ctrl K elsewhere. */
const isApple = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const SEARCH_SHORTCUT = isApple ? "⌘ K" : "Ctrl K";

/** True while the user is typing somewhere, so "/" can still be typed there. */
function isTypingIn(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { office, setOffice } = useOfficeFilter();
  const [officeMenuOpen, setOfficeMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);
  // Closing the gear menu (Esc, outside click, a link) hands focus back to the gear.
  const closeSettings = () => {
    setSettingsOpen(false);
    gearRef.current?.focus();
  };
  const settings = useMySettings();
  const notificationsOn = settings.data?.notifications.enabled ?? true;
  const [searchValue, setSearchValue] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl/⌘ K (or "/" when not typing in a field) jumps to the employee search.
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const combo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      const slash = e.key === "/" && !e.ctrlKey && !e.metaKey && !isTypingIn(e.target);
      if (!(combo || slash) || !searchRef.current) return;
      e.preventDefault();
      searchRef.current.focus();
      searchRef.current.select();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Publish the bar's real height so the sticky sidebar sits right under it,
  // however tall the bar ends up (font, wrapping, zoom).
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--topbar-h", `${header.offsetHeight}px`);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, [user]);
  const announcementsQuery = useQuery({ queryKey: ["employee", "announcements"], queryFn: fetchAnnouncements });
  const notifications = announcementsQuery.data ?? [];
  const photoQuery = useQuery({
    queryKey: ["employee", "my-photo"],
    queryFn: fetchMyPhoto,
    enabled: user?.role === "employee",
  });
  // Partner, HR and other accounts keep their photo in Settings.
  const avatarQuery = useQuery({
    queryKey: ["settings", "avatar", user ? settingsKeyFor(user) : "none"],
    queryFn: () => fetchMyAvatar(user!),
    enabled: !!user && user.role !== "employee",
  });
  const photo = user?.role === "employee" ? photoQuery.data : avatarQuery.data;
  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") e.currentTarget.blur();
    if (e.key === "Enter" && searchValue.trim()) {
      navigate(`/admin/maintenance/people?q=${encodeURIComponent(searchValue.trim())}`);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (!user) return null;
  // System-only accounts (Super Admin) don't get the office filter or employee search.
  const hr = user.role !== "admin" || hasHrAccess(user.accountId);

  return (
    <header ref={headerRef} className="topbar sticky top-0 z-40 flex flex-wrap items-center gap-3.5 px-4.5 py-2.5 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
      {/* Left · centre (search) · right, so the search sits in the middle of the bar (phones wrap instead). */}
      <div className="flex min-w-0 items-center gap-3.5">
      {/* Shown here only while no desktop sidebar is on screen; otherwise the sidebar carries them. */}
      <BrandName className="topbar-sidebar-dup" />
      {/* Phones only: on wider screens the sidebar already names the workspace. */}
      <WorkspaceLabel role={user.role} className="topbar-sidebar-dup sm:hidden" />

      {user.role === "admin" && hr && (
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={officeMenuOpen}
            onClick={() => {
              setOfficeMenuOpen((v) => !v);
              setNotifOpen(false);
              setSettingsOpen(false);
            }}
            className="topbar-field"
          >
            <BuildingIcon className="h-3.5 w-3.5" />
            {office}
            <ChevronDownIcon className="h-3 w-3" />
          </button>
          {officeMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Close office menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setOfficeMenuOpen(false)}
              />
              <div className="glass-surface panel-enter absolute left-0 top-full z-50 mt-1.5 w-44 rounded-[var(--radius-dropdown)] p-1">
                {offices.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      setOffice(o);
                      setOfficeMenuOpen(false);
                    }}
                    className={clsx(
                      "flex w-full items-center justify-between rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-sm hover:bg-[var(--nav-hover-bg)]",
                      o === office && "font-semibold text-brand-ink",
                    )}
                  >
                    {o}
                    {o === office && <CheckIcon className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      </div>

      <div className="mx-auto flex min-w-0 justify-center sm:mx-0">
        {user.role === "admin" && hr && (
          <div className="topbar-field hidden sm:flex sm:w-64 md:w-80 lg:w-96">
            <SearchIcon className="h-3.5 w-3.5" />
            <input
              ref={searchRef}
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search employee directory"
              aria-label="Search employee directory"
              aria-keyshortcuts={isApple ? "Meta+K /" : "Control+K /"}
              className="w-full min-w-0 bg-transparent font-normal focus:outline-none"
            />
            <kbd aria-hidden="true" className="flex-none rounded-[var(--radius-logo)] border border-[var(--line-strong)] bg-[var(--tint)] px-1.5 font-sans text-[10.5px] leading-5 font-medium text-ink-2">
              {SEARCH_SHORTCUT}
            </kbd>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center justify-end gap-1.5 sm:ml-0 sm:gap-2">

        <ThemeToggle className="topbar-icon-button !h-9 !w-9 [&_svg]:h-[17px] [&_svg]:w-[17px]" />

        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={notifOpen}
            onClick={() => {
              setNotifOpen((v) => !v);
              setOfficeMenuOpen(false);
              setSettingsOpen(false);
            }}
            className="topbar-icon-button relative flex h-9 w-9 items-center justify-center"
          >
            <BellIcon className="h-[17px] w-[17px]" />
            {notificationsOn && notifications.length > 0 && (
              <span className="topbar-dot absolute right-2 top-2 h-2 w-2 rounded-full" />
            )}
          </button>
          {notifOpen && (
            <>
              <button
                type="button"
                aria-label="Close notifications"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setNotifOpen(false)}
              />
              <div className="glass-surface panel-enter absolute right-0 top-full z-50 mt-1.5 w-72 rounded-[var(--radius-dropdown)]">
                <div className="border-b border-[var(--line)] px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-2">
                  Notifications
                </div>
                <div className="flex max-h-72 flex-col overflow-y-auto">
                  {!notificationsOn && (
                    <p className="px-3.5 py-4 text-sm text-ink-2">Notifications are turned off. Turn them on from the settings menu.</p>
                  )}
                  {notificationsOn && notifications.length === 0 && (
                    <p className="px-3.5 py-4 text-sm text-ink-2">You're all caught up.</p>
                  )}
                  {notificationsOn && notifications.map((a) => (
                    <div key={a.id} className="border-b border-border px-3.5 py-2.5 last:border-b-0">
                      <div className="text-[0.82rem] font-semibold">{a.title}</div>
                      <div className="text-xs text-ink-3">{a.postedOn}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            ref={gearRef}
            type="button"
            aria-label="Settings"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => {
              setSettingsOpen((v) => !v);
              setNotifOpen(false);
              setOfficeMenuOpen(false);
            }}
            className={clsx("topbar-icon-button flex h-9 w-9 items-center justify-center", settingsOpen && "bg-[var(--nav-hover-bg)] text-[var(--nav-hover-text)]")}
          >
            <SettingsIcon className="h-[17px] w-[17px]" />
          </button>
          {settingsOpen && (
            <>
              <button type="button" aria-label="Close settings" tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={closeSettings} />
              <SettingsMenu onClose={closeSettings} onLogout={handleLogout} />
            </>
          )}
        </div>

        {/* Divider between the tool buttons and the signed-in person. */}
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-[var(--line-strong)] sm:block" />

        <ProfileChip linked={user.role === "employee"}>
          {photo ? (
            <img src={photo} alt="" className="h-7 w-7 flex-none rounded-full object-cover" />
          ) : (
            <div className="topbar-avatar flex h-7 w-7 flex-none items-center justify-center rounded-full">
              {user.initials}
            </div>
          )}
          <div className="hidden min-w-0 max-w-48 leading-tight sm:block">
            <div className="topbar-name truncate">{settings.data?.account.displayName.trim() || user.name}</div>
            <div className="topbar-secondary truncate">{user.title}</div>
          </div>
        </ProfileChip>

        <button
          type="button"
          aria-label="Log out"
          onClick={handleLogout}
          className="topbar-icon-button flex h-9 w-9 items-center justify-center"
        >
          <LogOutIcon className="h-[17px] w-[17px]" />
        </button>
      </div>
    </header>
  );
}

/** The signed-in person. For employees it links to their 201 File. */
function ProfileChip({ linked, children }: { linked: boolean; children: ReactNode }) {
  if (!linked) return <div className="topbar-user flex items-center gap-2.5">{children}</div>;
  return (
    <Link to="/employee/201-file" title="Open my 201 File" className="topbar-user topbar-icon-button flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left">
      {children}
    </Link>
  );
}
