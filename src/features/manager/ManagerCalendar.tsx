import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarIcon } from "@/components/icons";
import { fetchApprovedLeaveSchedule, fetchOnLeaveToday } from "@/lib/api";
import { formatToday } from "@/lib/format";

export function ManagerCalendar() {
  const onLeaveQuery = useQuery({ queryKey: ["manager", "on-leave-today"], queryFn: fetchOnLeaveToday });
  const scheduleQuery = useQuery({
    queryKey: ["manager", "approved-leave-schedule"],
    queryFn: fetchApprovedLeaveSchedule,
  });

  return (
    <>
      <ContentHead title="Team Calendar" subtitle={formatToday()} />

      <Card>
        <CardHeader title="On leave today" meta={formatToday().split(",")[0]} />
        <CardBody className="flex flex-col gap-3">
          {onLeaveQuery.data?.length === 0 && (
            <EmptyState icon={<CalendarIcon />} title="No one on the team is on leave today" />
          )}
          {onLeaveQuery.data?.map((person) => (
            <div key={person.name} className="flex items-center gap-2.5">
              <MiniAvatar initials={person.initials} />
              <div>
                <div className="text-[0.85rem] font-semibold">{person.name}</div>
                <div className="text-xs text-ink-2">{person.reason}</div>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Upcoming approved leave" meta="This month" />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Team member", "Type", "Dates"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-4 py-2.5 text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduleQuery.data?.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <EmptyState
                      icon={<CalendarIcon />}
                      title="No approved leave scheduled yet"
                      description="Approve a pending request to see it here."
                    />
                  </td>
                </tr>
              )}
              {scheduleQuery.data?.map((r) => (
                <tr key={r.id}>
                  <td className="border-b border-border px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <MiniAvatar initials={r.employeeInitials} />
                      {r.employeeName}
                    </div>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">{r.type}</td>
                  <td className="border-b border-border px-4 py-2.5">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
