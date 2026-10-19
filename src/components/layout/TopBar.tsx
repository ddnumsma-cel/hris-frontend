import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useAuth } from "@/features/auth/AuthContext";
import { hasHrAccess } from "@/lib/admin/auth";
import { useOfficeFilter, type OfficeFilter } from "@/features/admin/OfficeFilterContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { fetchAnnouncements, fetchMyPhoto } from "@/lib/api";
import { teamNotices } from "@/lib/teamNotices";
import { listMyNotifications, markMyNotificationsRead } from "@/lib/notifications";
import { fmtDay } from "@/lib/preferences";
import { myNotices } from "@/lib/ess/more";
import { BellIcon, BuildingIcon, CheckIcon, ChevronDownIcon, LogOutIcon, SettingsIcon } from "../icons";
import { BrandName, WorkspaceLabel } from "./Brand";
import { PageSearch } from "./PageSearch";
import { SettingsMenu } from "./SettingsMenu";
import { NotificationsPanel, type NotificationItem, type NotificationKind } from "./NotificationsPanel";
import { timeAgo } from "@/lib/timeAgo";
import { SeatChip } from "@/features/subscription/shared";
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
  const headerRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl/⌘ K (or "/" when not typing in a field) jumps to the page search.
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
  // however tall the bar ends up (font, wrapping, zoom). The exact height, not a rounded one, or
  // the sidebar ends a fraction of a pixel off on some pages and the logo jumps between them.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--topbar-h", `${header.getBoundingClientRect().height}px`);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, [user]);
  const announcementsQuery = useQuery({ queryKey: ["employee", "announcements"], queryFn: fetchAnnouncements });
  // Team alerts (a manager's people working from home today) come first.
  const teamQuery = useQuery({ queryKey: ["team-notices"], queryFn: teamNotices, refetchInterval: 60_000 });
  // Policies the signed-in employee still has to read and confirm (stays until they do). Their
  // decisions, payslips and claims arrive as stored notifications below, so only these are taken.
  const mineQuery = useQuery({ queryKey: ["ess", "bell"], queryFn: myNotices, refetchInterval: 60_000 });
  const policyReminders = (mineQuery.data ?? []).filter((n) => n.id.startsWith("po-"));
  // Stored alerts (seat limits, upgrade requests…) for the signed-in role, newest first.
  const queryClient = useQueryClient();
  const myQuery = useQuery({ queryKey: ["notifications", user?.accountId], queryFn: listMyNotifications, refetchInterval: 30_000 });
  const alerts = (myQuery.data ?? []).map((n) => ({ id: n.id, title: n.title, link: n.link, unread: n.unread }));
  const unread = alerts.some((a) => a.unread);
  const items: NotificationItem[] = [
    ...(myQuery.data ?? []).map((n) => ({ id: n.id, kind: (n.kind === "alert" || !n.kind ? (/seat/i.test(n.title) ? "seat" : "alert") : n.kind) as NotificationKind, title: n.title, body: n.body, time: timeAgo(n.at, fmtDay), link: n.link })),
    ...(teamQuery.data ?? []).map((n) => ({ id: n.id, kind: "team" as const, title: n.title, body: n.postedOn, time: "Today" })),
    ...policyReminders.map((n) => ({ id: n.id, kind: "alert" as const, title: n.title, body: "Read it and confirm under Company policies.", time: n.postedOn, link: "/employee/policies" })),
    ...(announcementsQuery.data ?? []).map((n) => ({ id: n.id, kind: "news" as const, title: n.title, time: n.postedOn.replace(/^Posted\s+/, "") })),
  ];
  // What was new when the bell was opened, so it stays highlighted until the panel closes.
  const [openNew, setOpenNew] = useState<Set<string>>(new Set());
  // The bell's count: unread stored alerts, plus announcements and team notices not seen yet
  // (remembered per account in this browser; opening the bell counts as seeing them).
  const seenKey = `heyhr-bell-seen-${user?.accountId ?? "anon"}`;
  const [seen, setSeen] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(seenKey) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const others = [...(teamQuery.data ?? []), ...policyReminders, ...(announcementsQuery.data ?? [])];
  const unreadCount = alerts.filter((a) => a.unread).length + others.filter((n) => !seen.includes(n.id)).length;
  const markSeen = () => {
    const ids = others.map((n) => n.id);
    setSeen(ids);
    try {
      localStorage.setItem(seenKey, JSON.stringify(ids));
    } catch {
      // Blocked storage: the count comes back next visit.
    }
  };
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
  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (!user) return null;
  // System-only accounts (Super Admin) don't get the office filter.
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
        {/* Everyone can jump to any page of their own sidebar (PageSearch). */}
        <PageSearch
          inputRef={searchRef}
          keyshortcuts={isApple ? "Meta+K /" : "Control+K /"}
          shortcut={
            <kbd aria-hidden="true" className="flex-none rounded-[var(--radius-logo)] border border-[var(--line-strong)] bg-[var(--tint)] px-1.5 font-sans text-[10.5px] leading-5 font-medium text-ink-2">
              {SEARCH_SHORTCUT}
            </kbd>
          }
        />
      </div>

      <div className="ml-auto flex items-center justify-end gap-1.5 sm:ml-0 sm:gap-2">
        {user.role === "admin" && <SeatChip />}

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
              // Opening the bell counts as reading the stored alerts; they stay listed.
              if (!notifOpen) setOpenNew(new Set([...alerts.filter((a) => a.unread).map((a) => a.id), ...others.filter((n) => !seen.includes(n.id)).map((n) => n.id)]));
              if (!notifOpen && unread) void markMyNotificationsRead().then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
              if (!notifOpen) markSeen();
            }}
            aria-description={notificationsOn && unreadCount > 0 ? `${unreadCount} new` : undefined}
            className="topbar-icon-button relative flex h-9 w-9 items-center justify-center"
          >
            <BellIcon className="h-[17px] w-[17px]" />
            {notificationsOn && unreadCount > 0 && (
              <span aria-hidden="true" className="bell-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] leading-none font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
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
              <NotificationsPanel items={items} newIds={openNew} enabled={notificationsOn} settingsLink={`/${user.role}/settings/notifications`} onClose={() => setNotifOpen(false)} />
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
