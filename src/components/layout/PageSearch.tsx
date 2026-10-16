import { useId, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { ChevronRightIcon, SearchIcon } from "@/components/icons";
import { matchPages, useNavPages, type NavPage } from "./navIndex";

/**
 * The top bar's page search, for everyone signed in: the pages and sub-pages of their own sidebar
 * (so only pages they may open) drop down as they type; Enter or a click goes there.
 */
export function PageSearch({ inputRef, shortcut, keyshortcuts }: { inputRef: Ref<HTMLInputElement>; shortcut: ReactNode; keyshortcuts: string }) {
  const navigate = useNavigate();
  const pages = useNavPages();
  const listId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hits = matchPages(pages, text);
  const showPanel = open && text.trim().length > 0;

  function go(page: NavPage, input: HTMLInputElement | null) {
    setText("");
    setOpen(false);
    input?.blur();
    navigate(page.to);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (showPanel) setOpen(false);
      else e.currentTarget.blur();
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && hits.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % hits.length : (i - 1 + hits.length) % hits.length));
    } else if (e.key === "Enter" && hits[active]) {
      go(hits[active], e.currentTarget);
    }
  }

  return (
    <div className="topbar-field relative hidden sm:flex sm:w-64 md:w-80 lg:w-96">
      <SearchIcon className="h-3.5 w-3.5" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && hits[active] ? `${listId}-${active}` : undefined}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="Search pages"
        aria-label="Search pages"
        aria-keyshortcuts={keyshortcuts}
        className="w-full min-w-0 bg-transparent font-normal focus:outline-none"
      />
      {shortcut}
      {showPanel && (
        // Mouse down here keeps focus in the field, so a click lands before the panel closes.
        <div className="glass-surface panel-enter absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-[var(--radius-dropdown)] shadow-[var(--shadow-panel)]" onMouseDown={(e) => e.preventDefault()}>
          <ul id={listId} role="listbox" aria-label="Pages" className="max-h-[min(24rem,60dvh)] overflow-y-auto p-1">
            {hits.map((p, i) => (
              <li
                key={p.to}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(p, null)}
                className={clsx("flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 py-2", i === active && "bg-[var(--nav-hover-bg)]")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{p.label}</span>
                  {p.trail && <span className="block truncate text-xs text-ink-2">{p.trail}</span>}
                </span>
                <ChevronRightIcon aria-hidden="true" className="h-4 w-4 flex-none text-ink-2" />
              </li>
            ))}
          </ul>
          {!hits.length && <p className="px-4 py-3 text-sm text-ink-2">No page matches “{text.trim()}”.</p>}
        </div>
      )}
    </div>
  );
}
