import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useAuth } from "@/features/auth/AuthContext";
import { useOfficeFilter, type OfficeFilter } from "@/features/admin/OfficeFilterContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { fetchAnnouncements, fetchMyPhoto } from "@/lib/api";
import { BellIcon, BuildingIcon, CheckIcon, ChevronDownIcon, LogOutIcon, SearchIcon } from "../icons";
import { BrandName, WorkspaceLabel } from "./Brand";

const offices: OfficeFilter[] = ["All offices", "Cebu HQ", "Manila", "Davao"];

export function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { office, setOffice } = useOfficeFilter();
  const [officeMenuOpen, setOfficeMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const headerRef = useRef<HTMLElement>(null);

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

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchValue.trim()) {
      navigate(`/admin/people?q=${encodeURIComponent(searchValue.trim())}`);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (!user) return null;

  return (
    <header ref={headerRef} className="topbar sticky top-0 z-40 flex flex-wrap items-center gap-3.5 px-4.5 py-2.5">
      {/* Shown here only while no desktop sidebar is on screen; otherwise the sidebar carries them. */}
      <BrandName className="topbar-sidebar-dup" />

      {user.role === "admin" && (
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={officeMenuOpen}
            onClick={() => {
              setOfficeMenuOpen((v) => !v);
              setNotifOpen(false);
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
              <div className="panel-enter absolute left-0 top-full z-50 mt-1.5 w-44 rounded-lg border border-border bg-surface p-1 text-ink shadow-lg">
                {offices.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      setOffice(o);
                      setOfficeMenuOpen(false);
                    }}
                    className={clsx(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface-2",
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

      <WorkspaceLabel role={user.role} className="topbar-sidebar-dup mx-auto" />

      <div className="ml-auto flex items-center gap-2">
        {user.role === "admin" && (
          <div className="topbar-field hidden min-w-37.5 sm:flex">
            <SearchIcon className="h-3.5 w-3.5" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search employee directory"
              aria-label="Search employee directory"
              className="w-full bg-transparent font-normal focus:outline-none"
            />
          </div>
        )}

        <ThemeToggle className="topbar-icon-button [&_svg]:h-[17px] [&_svg]:w-[17px]" />

        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={notifOpen}
            onClick={() => {
              setNotifOpen((v) => !v);
              setOfficeMenuOpen(false);
            }}
            className="topbar-icon-button relative flex h-8 w-8 items-center justify-center rounded-lg"
          >
            <BellIcon className="h-[17px] w-[17px]" />
            {notifications.length > 0 && (
              <span className="topbar-dot absolute right-1.5 top-1.5 h-2 w-2 rounded-full" />
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
              <div className="panel-enter absolute right-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-border bg-surface text-ink shadow-lg">
                <div className="border-b border-border px-3.5 py-2.5 text-xs font-medium tracking-[0.01em] text-ink-3">
                  Notifications
                </div>
                <div className="flex max-h-72 flex-col overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="px-3.5 py-4 text-sm text-ink-2">You're all caught up.</p>
                  )}
                  {notifications.map((a) => (
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

        <div className="flex items-center gap-2">
          {photoQuery.data ? (
            <img src={photoQuery.data} alt="" className="h-7.5 w-7.5 flex-none rounded-full object-cover" />
          ) : (
            <div className="topbar-avatar flex h-7.5 w-7.5 items-center justify-center rounded-full">
              {user.initials}
            </div>
          )}
          <div className="hidden leading-tight sm:block">
            <div className="topbar-name">{user.name}</div>
            <div className="topbar-secondary">{user.title}</div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Log out"
          onClick={handleLogout}
          className="topbar-icon-button flex h-8 w-8 items-center justify-center rounded-lg"
        >
          <LogOutIcon className="h-[17px] w-[17px]" />
        </button>
      </div>
    </header>
  );
}
