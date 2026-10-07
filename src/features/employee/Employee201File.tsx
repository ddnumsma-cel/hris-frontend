import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { DownloadIcon, EditIcon } from "@/components/icons";
import { formatToday } from "@/lib/format";
import { File201View } from "./file201/File201View";
import { useFile201 } from "./file201/useFile201";

export function Employee201File() {
  const f = useFile201();
  return (
    <>
      <ContentHead
        title="201 File"
        subtitle={formatToday()}
        actions={
          <>
            <Button variant="ghost" icon={<EditIcon className="h-3.75 w-3.75" />} onClick={f.editProfile} disabled={!f.employee}>
              Edit profile
            </Button>
            <Button icon={<DownloadIcon className="h-3.75 w-3.75" />} onClick={f.print} disabled={!f.employee}>
              Print summary
            </Button>
          </>
        }
      />
      <File201View f={f} />
      {f.dialogs}
    </>
  );
}
