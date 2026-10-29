import { SettingsHeader } from "@/components/ui/SettingsCard";
import { RolesPage } from "@/features/admin/administration/RolesPage";
import { Embedded } from "./SettingsLayout";

/**
 * The existing Roles & access screen (roles are per-module access levels, managed there). Super Admin
 * only, as on its own page. The people who hold them are listed in the Users section.
 */
export function RolesSection() {
  return (
    <>
      <SettingsHeader title="Roles & permissions" />
      <Embedded>
        <RolesPage />
      </Embedded>
    </>
  );
}
