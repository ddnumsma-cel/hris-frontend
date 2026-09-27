import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { StatTile } from "@/components/ui/StatTile";
import { fetchAttendanceTrend } from "@/lib/api";
import { formatToday } from "@/lib/format";
import { managerTeamStats } from "@/lib/mockData";
import { AttendanceChart } from "./AttendanceChart";

const biometricDevices = [
  { office: "Cebu HQ", device: "OmniTraQ scanner, 3rd floor", status: "Online" as const },
  { office: "Manila", device: "OmniTraQ scanner, lobby", status: "Online" as const },
  { office: "Davao", device: "OmniTraQ scanner, lobby", status: "Offline" as const },
  { office: "All offices (remote)", device: "Face recognition service — WFH clock-in", status: "Online" as const },
];

const deviceVariant: Record<"Online" | "Offline", ChipVariant> = {
  Online: "good",
  Offline: "crit",
};

export function ManagerAttendancePage() {
  const attendanceQuery = useQuery({ queryKey: ["manager", "attendance-trend"], queryFn: fetchAttendanceTrend });

  return (
    <>
      <ContentHead title="Attendance" subtitle={formatToday()} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] sm:gap-3.5">
        <StatTile label="Attendance rate" value={`${managerTeamStats.attendanceRate}%`} delta="last 14 days" tone="good" />
        <StatTile label="On leave today" value={managerTeamStats.onLeaveToday} delta="of the team" />
        <StatTile label="Team headcount" value={managerTeamStats.teamHeadcount} />
      </div>

      <Card>
        <CardHeader title="Team attendance — last 14 days" meta="On-time rate" />
        <CardBody>{attendanceQuery.data && <AttendanceChart data={attendanceQuery.data} />}</CardBody>
      </Card>

      <Card>
        <CardHeader title="Biometric device status" meta="Time & attendance hardware" />
        <CardBody className="flex flex-col gap-3">
          {biometricDevices.map((d) => (
            <div key={d.office} className="flex items-center justify-between gap-2.5">
              <div>
                <div className="text-[0.85rem] font-semibold">{d.office}</div>
                <div className="text-xs text-ink-2">{d.device}</div>
              </div>
              <Chip variant={deviceVariant[d.status]}>{d.status}</Chip>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
