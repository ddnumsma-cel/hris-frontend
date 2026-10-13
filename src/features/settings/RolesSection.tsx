import { SettingsHeader } from "@/components/ui/SettingsCard";
import { useCan } from "@/lib/useCan";
import { RolesPage } from "@/features/admin/administration/RolesPage";
import { UsersPage } from "@/features/admin/administration/UsersPage";
import { Embedded } from "./SettingsLayout";

/**
 * The existing Roles & access and Users screens (roles are per-module access levels, managed
 * there). Roles are Super Admin only, as on their own page.
 */
export function RolesSection() {
  const canSeeRoles = useCan("view", "roleAssignment");
  return (
    <>
      <SettingsHeader title="Roles & permissions" />
      {canSeeRoles && (
        <Embedded>
          <RolesPage />
        </Embedded>
      )}
      <Embedded>
        <UsersPage />
      </Embedded>
    </>
  );
}
