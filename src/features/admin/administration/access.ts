import { useAuth } from "@/features/auth/AuthContext";
import { accessFor } from "@/lib/admin/auth";
import type { Access, ModuleKey } from "@/lib/admin/store";

/** Which module a page in the HR workspace belongs to. The Overview belongs to none. */
export function moduleForPath(pathname: string): ModuleKey | null {
  const seg = pathname.split("/")[2] ?? "";
  if (seg === "people" || seg === "directory") return "people";
  if (seg === "company" || seg === "organization" || seg === "positions") return "company";
  if (seg === "documents") return "documents";
  if (seg === "timekeeping") return "timekeeping";
  if (seg === "leave") return "leave";
  if (seg === "reports") return "reports";
  if (seg === "administration") return "administration";
  return null;
}

/** The signed-in account's access to each HR module. */
export function useAccess(): Record<ModuleKey, Access> {
  const { user } = useAuth();
  return accessFor(user?.accountId);
}
