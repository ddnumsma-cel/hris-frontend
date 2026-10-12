// The bell's dropdown, laid out like the notification centres people know from everyday apps:
// a title row, All / Unread tabs, "New" and "Earlier" groups, and one row per notification with
// a round type icon, a bold title, two lines of detail, a short time and a dot while unread.

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { AlertTriangleIcon, BellIcon, CheckIcon, HomeIcon, InboxIcon, MegaphoneIcon, RefreshIcon, XIcon } from "../icons";

export type NotificationKind = "seat" | "alert" | "request" | "approved" | "rejected" | "update" | "team" | "news";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  time?: string;
  link?: string;
}

const KIND_ICON: Record<NotificationKind, { icon: ReactNode; className: string }> = {
  seat: { icon: <AlertTriangleIcon className="h-4 w-4" />, className: "notif-icon-seat" },
  alert: { icon: <BellIcon className="h-4 w-4" />, className: "notif-icon-alert" },
  request: { icon: <InboxIcon className="h-4 w-4" />, className: "notif-icon-alert" },
  approved: { icon: <CheckIcon className="h-4 w-4" />, className: "notif-icon-team" },
  rejected: { icon: <XIcon className="h-4 w-4" />, className: "notif-icon-rejected" },
  update: { icon: <RefreshIcon className="h-4 w-4" />, className: "notif-icon-news" },
  team: { icon: <HomeIcon className="h-4 w-4" />, className: "notif-icon-team" },
  news: { icon: <MegaphoneIcon className="h-4 w-4" />, className: "notif-icon-news" },
};

export function NotificationsPanel({
  items,
  newIds,
  enabled,
  settingsLink,
  onClose,
}: {
  items: NotificationItem[];
  /** What was unread when the panel opened; stays highlighted until it closes. */
  newIds: Set<string>;
  enabled: boolean;
  settingsLink: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const fresh = items.filter((n) => newIds.has(n.id));
  const earlier = items.filter((n) => !newIds.has(n.id));
  const groups = tab === "unread" ? [{ label: "New", list: fresh }] : [{ label: "New", list: fresh }, { label: "Earlier", list: earlier }];
  const empty = tab === "unread" ? fresh.length === 0 : items.length === 0;

  return (
    <div role="dialog" aria-label="Notifications" className="glass-surface panel-enter absolute right-0 top-full z-50 mt-2 flex w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-[var(--radius-dropdown)] shadow-[var(--shadow-drawer)]">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 className="text-base font-semibold text-ink">Notifications</h2>
        {enabled && (
          <div role="tablist" aria-label="Show" className="flex gap-1 rounded-full bg-surface-2 p-1">
            {(["all", "unread"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className="notif-tab rounded-full px-3 py-1 text-xs font-medium text-ink-2 transition-colors duration-150 hover:text-ink"
              >
                {t === "all" ? "All" : `Unread${fresh.length ? ` (${fresh.length})` : ""}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-h-[min(440px,70vh)] overflow-y-auto border-t border-[var(--line)]">
        {!enabled ? (
          <EmptyState title="Notifications are off" text="Turn them on from the settings menu to see alerts and announcements here." />
        ) : empty ? (
          <EmptyState title="You're all caught up" text={tab === "unread" ? "No new notifications." : "New alerts and announcements will show up here."} />
        ) : (
          groups
            .filter((g) => g.list.length)
            .map((g) => (
              <section key={g.label} className="py-2">
                <h3 className="px-4 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">{g.label}</h3>
                <ul className="flex flex-col gap-1 px-2">
                  {g.list.map((n) => (
                    <li key={n.id}>
                      <Row item={n} unread={newIds.has(n.id)} onClose={onClose} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
        )}
      </div>

      <div className="border-t border-[var(--line)] px-4 py-3 text-center">
        <Link to={settingsLink} onClick={onClose} className="text-[13px] font-medium text-brand hover:underline">
          Notification settings
        </Link>
      </div>
    </div>
  );
}

function Row({ item, unread, onClose }: { item: NotificationItem; unread: boolean; onClose: () => void }) {
  const kind = KIND_ICON[item.kind];
  const content = (
    <>
      <span aria-hidden="true" className={clsx("flex h-9 w-9 flex-none items-center justify-center rounded-full", kind.className)}>
        {kind.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={clsx("text-[13px] leading-snug text-ink", unread ? "font-semibold" : "font-medium")}>{item.title}</span>
        {item.body && <span className="line-clamp-2 text-xs leading-relaxed text-ink-2">{item.body}</span>}
        <span className="flex items-center justify-between gap-2">
          {item.time ? <span className={clsx("text-[11px] font-medium", unread ? "text-brand" : "text-ink-2")}>{item.time}</span> : <span />}
          {/* What clicking does: requests are there to act on, the rest to look at. */}
          {item.link && <span className={clsx("notif-action rounded-full px-3 py-1 text-[11px] font-semibold", item.kind === "request" && "notif-action-primary")}>{item.kind === "request" ? "Review" : "View"}</span>}
        </span>
      </span>
      {unread && <span aria-label="Unread" className="mt-1.5 h-2 w-2 flex-none rounded-full bg-brand" />}
    </>
  );
  const className = clsx("flex items-start gap-3 rounded-[var(--radius-control)] px-2 py-2 transition-colors duration-150", unread && "notif-unread", item.link && "hover:bg-[var(--nav-hover-bg)]");
  return item.link ? (
    <Link to={item.link} onClick={onClose} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">
        <BellIcon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="text-xs text-ink-2">{text}</p>
    </div>
  );
}
