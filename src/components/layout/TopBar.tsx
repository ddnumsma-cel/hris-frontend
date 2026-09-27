import { useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useAuth } from "@/features/auth/AuthContext";
import { useOfficeFilter, type OfficeFilter } from "@/features/admin/OfficeFilterContext";
import { fetchAnnouncements } from "@/lib/api";
import { getEffectiveTheme, applyTheme, type Theme } from "@/lib/theme";
import { BellIcon, BuildingIcon, CheckIcon, ChevronDownIcon, LogOutIcon, MoonIcon, SearchIcon, SunIcon } from "../icons";

const roleLabels = {
  employee: "Employee",
  manager: "Partner",
  admin: "HR",
} as const;

const offices: OfficeFilter[] = ["All offices", "Cebu HQ", "Manila", "Davao"];

export function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { office, setOffice } = useOfficeFilter();
  const [officeMenuOpen, setOfficeMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [theme, setTheme] = useState<Theme>(() => (typeof window === "undefined" ? "light" : getEffectiveTheme()));
  const announcementsQuery = useQuery({ queryKey: ["employee", "announcements"], queryFn: fetchAnnouncements });
  const notifications = announcementsQuery.data ?? [];

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchValue.trim()) {
      navigate(`/admin/directory?q=${encodeURIComponent(searchValue.trim())}`);
    }
  }

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center gap-3.5 border-b border-white/10 bg-brand-dark px-4.5 py-2.5 text-[#F2FAF9]">
      <div className="flex items-center gap-2.5 whitespace-nowrap font-display text-base font-extrabold tracking-tight">
        <img src="/brand/msma-mark.png" alt="MSMA" className="h-7.5 w-auto" />
        MSMA
      </div>

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
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-sm text-[#EAF6F5]"
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
                      o === office && "font-bold text-brand-ink",
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

      <span className="mx-auto rounded-lg bg-white/10 px-3.5 py-1.5 text-[0.82rem] font-semibold text-[#EAF6F5]">
        {roleLabels[user.role]} workspace
      </span>

      <div className="ml-auto flex items-center gap-3">
        {user.role === "admin" && (
          <div className="hidden min-w-37.5 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 sm:flex">
            <SearchIcon className="h-3.5 w-3.5 text-[#CFE6E4]" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search employee directory"
              aria-label="Search employee directory"
              className="w-full bg-transparent text-sm text-[#F2FAF9] placeholder:text-[#9FC0BD] focus:outline-none"
            />
          </div>
        )}

        <button
          type="button"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
        >
          {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
        </button>

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
            className="relative flex"
          >
            <BellIcon className="h-4.5 w-4.5" />
            {notifications.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-[1.5px] border-brand-dark bg-gold" />
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
                <div className="border-b border-border px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-ink-3">
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
          <div className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-gold text-xs font-bold text-[#2B1C05]">
            {user.initials}
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-bold">{user.name}</div>
            <div className="text-xs text-[#AFCBC8]">{user.title}</div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Log out"
          onClick={handleLogout}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
        >
          <LogOutIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
