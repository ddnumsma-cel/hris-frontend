import { UsersPage } from "@/features/admin/administration/UsersPage";
import { Embedded } from "./SettingsLayout";

/** Everyone who can sign in to the company's HRIS: the existing Users screen, whose own heading (with Add user) heads the section. */
export function UsersSection() {
  return (
    <Embedded asTitle>
      <UsersPage />
    </Embedded>
  );
}
