import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { DownloadIcon, MenuIcon, XIcon } from "@/components/icons";

export interface BottomTab {
  label: string;
  to: string;
  icon: ReactNode;
  end?: boolean;
}

/** Opens the phone slide-in menu (SideNav listens for it). */
export const OPEN_NAV_MENU = "open-nav-menu";

const INSTALL_DISMISSED = "install-app-dismissed";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** The browser's "install this app" offer, kept until the person installs or says no. */
function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISSED) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(INSTALL_DISMISSED, "1");
    } catch {
      // Asked again next visit; fine.
    }
  };
  const install = async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    if (outcome === "dismissed") dismiss();
  };
  return { canInstall: !!event && !dismissed, install, dismiss };
}

/** Phones only: the main pages as a tab bar along the bottom, with More opening the full menu. */
export function BottomTabs({ tabs }: { tabs: BottomTab[] }) {
  const { canInstall, install, dismiss } = useInstallPrompt();
  return (
    <div className="bottom-tabs fixed inset-x-0 bottom-0 z-30 sm:hidden">
      {canInstall && (
        <div className="glass-surface mx-4 mb-2 flex items-center gap-3 rounded-[var(--radius-card)] px-4 py-2 text-[13px]">
          <DownloadIcon className="h-4 w-4 flex-none text-brand-ink" />
          <span className="min-w-0 flex-1">Add this app to your home screen for quick clock-ins and payslips.</span>
          <button type="button" onClick={install} className="font-semibold text-brand-ink">
            Install
          </button>
          <button type="button" aria-label="Not now" onClick={dismiss} className="text-ink-3">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}
      <nav aria-label="Main" className="glass-surface grid grid-cols-5 border-t border-border pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => clsx("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium [&_svg]:h-5 [&_svg]:w-5", isActive ? "text-brand-ink" : "text-ink-2")}>
            {t.icon}
            {t.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_NAV_MENU))} className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-2 [&_svg]:h-5 [&_svg]:w-5">
          <MenuIcon />
          More
        </button>
      </nav>
    </div>
  );
}
