import { useState } from "react";
import clsx from "clsx";
import { MoonIcon, SunIcon } from "@/components/icons";
import { applyTheme, getEffectiveTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => (typeof window === "undefined" ? "light" : getEffectiveTheme()));

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
      className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", className)}
    >
      {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
}
