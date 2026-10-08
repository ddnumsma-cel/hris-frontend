import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/features/auth/AuthContext";
import { applyAccountPrefs, applyAppearance } from "@/lib/preferences";
import { fetchMySettings, saveMySettings } from "@/lib/settings/api";
import { settingsKeyFor, type UserSettings } from "@/lib/settings/store";

type Section = keyof Omit<UserSettings, "updatedAt">;

export const settingsQueryKey = (key: string) => ["settings", key] as const;

/** The signed-in person's settings. */
export function useMySettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: settingsQueryKey(user ? settingsKeyFor(user) : "none"),
    queryFn: () => fetchMySettings(user!),
    enabled: !!user,
  });
}

/** Saves one section, applies it live, and confirms with a toast (quiet for quick toggles). */
export function useSaveSettings<K extends Section>(section: K, { quiet = false }: { quiet?: boolean } = {}) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: UserSettings[K]) => saveMySettings(user!, section, value),
    onSuccess: (next) => {
      queryClient.setQueryData(settingsQueryKey(settingsKeyFor(user!)), next);
      if (section === "appearance") applyAppearance(next.appearance);
      if (section === "account") applyAccountPrefs(next.account);
      if (!quiet) toast.show("Settings saved.");
    },
    onError: (e: Error) => toast.show(e.message || "Couldn't save your settings. Try again.", "critical"),
  });
}

/**
 * Editable copy of saved values. `dirty` while it differs from what's saved; it resets to the
 * saved values whenever those change (after a save, or a first load) unless edits are pending.
 */
export function useDraft<T>(saved: T | undefined) {
  const [draft, setDraft] = useState<T | undefined>(saved);
  // Compared by value, not identity: callers may build `saved` fresh on every render.
  const savedKey = saved === undefined ? undefined : JSON.stringify(saved);
  const [baseKey, setBaseKey] = useState(savedKey);
  if (savedKey !== baseKey) {
    setBaseKey(savedKey);
    setDraft(saved);
  }
  const dirty = draft !== undefined && JSON.stringify(draft) !== savedKey;
  return { draft, setDraft, dirty, discard: () => setDraft(saved) };
}

/**
 * Warns before leaving with unsaved changes: in-app links ask for confirmation, and the browser
 * asks on refresh or close. Returns the confirmation dialog to render.
 * (The browser Back button isn't intercepted: that needs React Router's data router.)
 */
export function useUnsavedGuard(dirty: boolean) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin) return;
      const to = a.pathname + a.search + a.hash;
      if (to === window.location.pathname + window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(to);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return (
    <ConfirmDialog
      open={pending !== null}
      title="Leave without saving?"
      message="You have unsaved changes in this section. If you leave now, they'll be lost."
      confirmLabel="Leave without saving"
      pendingLabel="Leaving…"
      cancelLabel="Stay"
      onConfirm={() => {
        const to = pending!;
        dirtyRef.current = false;
        setPending(null);
        navigate(to);
      }}
      onClose={() => setPending(null)}
    />
  );
}
