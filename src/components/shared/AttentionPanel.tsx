import type { ReactNode } from "react";
import clsx from "clsx";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CheckIcon } from "@/components/icons";

export interface AttentionItem {
  id: string;
  icon: ReactNode;
  title: string;
  detail?: string;
  tone: "info" | "warn" | "crit";
  action?: { label: string; onClick: () => void };
}

const toneBg: Record<AttentionItem["tone"], string> = {
  info: "bg-surface-2 text-ink-2",
  warn: "bg-warning-tint text-warning",
  crit: "bg-critical-tint text-critical",
};

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  return (
    <Card data-tour="attention-panel">
      <CardHeader
        title="Needs your attention"
        meta={items.length ? `${items.length} auto-detected` : "All clear"}
      />
      <CardBody className="flex flex-col gap-3">
        {items.length === 0 && (
          <div className="flex items-center gap-2.5 text-sm text-ink-2">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-good-tint text-good">
              <CheckIcon className="h-4 w-4" />
            </span>
            Nothing needs attention right now.
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5">
            <span
              className={clsx(
                "flex h-8 w-8 flex-none items-center justify-center rounded-full",
                toneBg[item.tone],
              )}
            >
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.85rem] font-semibold">{item.title}</div>
              {item.detail && <p className="mt-0.5 text-xs text-ink-2">{item.detail}</p>}
            </div>
            {item.action && (
              <button
                type="button"
                onClick={item.action.onClick}
                className="flex-none text-xs font-semibold text-brand-ink"
              >
                {item.action.label}
              </button>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
