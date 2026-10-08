import clsx from "clsx";
import { MoonIcon, SunIcon } from "@/components/icons";
import { applyTheme, type Theme } from "@/lib/theme";
import { useEffectiveTheme } from "@/lib/useTheme";

/** Moon/sun button. Reads the shared theme, so it stays in sync with the gear menu and Settings. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useEffectiveTheme();

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
  }

  return (
    <button
      type="button"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
      className={clsx("flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)]", className)}
    >
      {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
}
