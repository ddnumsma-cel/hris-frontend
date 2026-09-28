import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProfileSettingsForm } from "@/components/shared/ProfileSettingsForm";
import { fetchManagerProfile, updateManagerProfile } from "@/lib/api";

export function ManagerSettings() {
  const profileQuery = useQuery({ queryKey: ["manager", "profile"], queryFn: fetchManagerProfile });

  return (
    <>
      <ContentHead title="Settings" subtitle="Your Partner profile and contact information" />
      {profileQuery.data ? (
        <ProfileSettingsForm
          profile={profileQuery.data}
          save={updateManagerProfile}
          queryKey={["manager", "profile"]}
          personalMeta="Shown in the top bar and on cases you file"
          aboutPlaceholder="Practice areas, certifications, anything your team should know"
        />
      ) : (
        <Card className="p-4">
          <Skeleton className="h-40 w-full" />
        </Card>
      )}
    </>
  );
}
