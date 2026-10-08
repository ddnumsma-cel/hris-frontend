import { Button } from "./Button";

/** Sticky bar shown only while a settings section has unsaved changes. */
export function SaveBar({
  visible,
  saving,
  invalid,
  onDiscard,
  onSave,
}: {
  visible: boolean;
  saving: boolean;
  /** Disables Save while the form has errors. */
  invalid: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  if (!visible) return null;
  return (
    <div role="region" aria-label="Unsaved changes" className="sticky bottom-4 z-30 mt-2">
      <div className="glass-surface panel-enter flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-dropdown)] px-4 py-3">
        <span className="text-[13px] font-medium text-ink">You have unsaved changes</span>
        <span className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={saving} onClick={onDiscard}>
            Discard
          </Button>
          <Button size="sm" disabled={saving || invalid} onClick={onSave}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </span>
      </div>
    </div>
  );
}
