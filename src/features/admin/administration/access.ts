import { useAuth } from "@/features/auth/AuthContext";
import { accessFor } from "@/lib/admin/auth";
import { isSuperAdmin } from "@/lib/admin/store";
import type { Access, ModuleKey } from "@/lib/admin/store";

/** Which module a page in the HR workspace belongs to. The Overview belongs to none. */
export function moduleForPath(pathname: string): ModuleKey | null {
  const seg = pathname.split("/")[2] ?? "";
  if (seg === "people" || seg === "directory") return "people";
  if (seg === "company" || seg === "organization" || seg === "positions") return "company";
  if (seg === "documents") return "documents";
  if (seg === "timekeeping") return "timekeeping";
  if (seg === "leave") return "leave";
  if (seg === "reimbursements") return "reimbursements";
  if (seg === "reports") return "reports";
  if (seg === "administration") return "administration";
  return null;
}

/** The signed-in account's access to each HR module. */
export function useAccess(): Record<ModuleKey, Access> {
  const { user } = useAuth();
  return accessFor(user?.accountId);
}

/** Pages only a Super Admin can open. */
export const SUPER_ADMIN_PAGES = ["/admin/administration/roles", "/admin/administration/settings"];

export function useIsSuperAdmin() {
  const { user } = useAuth();
  // Sessions from before user accounts existed keep full access.
  return !user?.accountId || isSuperAdmin(user.accountId);
}
