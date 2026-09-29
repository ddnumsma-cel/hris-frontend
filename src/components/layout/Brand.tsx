import clsx from "clsx";
import type { Role } from "@/lib/types";

const roleLabels: Record<Role, string> = {
  employee: "Employee",
  manager: "Partner",
  admin: "HR",
};

/** HeyHR wordmark. The SVG recolors itself per color scheme; index.css (.brand-wordmark) passes it the app's theme. */
export function BrandName({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center", className)}>
      <img src="/brand/heyhr-wordmark.svg" alt="HeyHR" className="brand-wordmark" />
    </div>
  );
}

/** "pill" is the bordered chip used in the top bar; "caption" is plain subtitle text. */
export function WorkspaceLabel({
  role,
  variant = "pill",
  className,
}: {
  role: Role;
  variant?: "pill" | "caption";
  className?: string;
}) {
  return (
    <span className={clsx(variant === "pill" ? "topbar-field" : "brand-caption", className)}>
      {roleLabels[role]} workspace
    </span>
  );
}
