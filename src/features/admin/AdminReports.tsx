import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DownloadIcon } from "@/components/icons";
import {
  fetchAttendanceTrend,
  fetchComplianceCalendar,
  fetchHeadcountByOffice,
  fetchPayrollCostBreakdown,
} from "@/lib/api";
import { downloadTextFile, toCsv } from "@/lib/download";
import { formatToday } from "@/lib/format";

export function AdminReports() {
  const headcountQuery = useQuery({ queryKey: ["admin", "headcount-by-office"], queryFn: fetchHeadcountByOffice });
  const costQuery = useQuery({ queryKey: ["admin", "payroll-cost"], queryFn: fetchPayrollCostBreakdown });
  const attendanceQuery = useQuery({ queryKey: ["manager", "attendance-trend"], queryFn: fetchAttendanceTrend });
  const complianceQuery = useQuery({ queryKey: ["admin", "compliance-calendar"], queryFn: fetchComplianceCalendar });

  const reports = [
    {
      title: "Headcount by office",
      description: "Current headcount broken down by office location.",
      disabled: !headcountQuery.data,
      download: () => {
        const csv = toCsv(headcountQuery.data!.map((h) => ({ office: h.office, count: h.count })));
        downloadTextFile("headcount-by-office.csv", csv, "text/csv");
      },
    },
    {
      title: "Payroll cost breakdown",
      description: "Percentage split of the current payroll run by cost category.",
      disabled: !costQuery.data,
      download: () => {
        const csv = toCsv(costQuery.data!.map((c) => ({ category: c.label, percent: c.percent })));
        downloadTextFile("payroll-cost-breakdown.csv", csv, "text/csv");
      },
    },
    {
      title: "Attendance trend",
      description: "Daily on-time attendance rate for the last two weeks.",
      disabled: !attendanceQuery.data,
      download: () => {
        const csv = toCsv(attendanceQuery.data!.map((a) => ({ date: a.date, on_time_rate_percent: a.rate })));
        downloadTextFile("attendance-trend.csv", csv, "text/csv");
      },
    },
    {
      title: "Compliance calendar",
      description: "Statutory filing deadlines and their current status.",
      disabled: !complianceQuery.data,
      download: () => {
        const csv = toCsv(
          complianceQuery.data!.map((c) => ({
            filing: c.filing,
            agency: c.agency,
            due: c.due,
            status: c.status,
          })),
        );
        downloadTextFile("compliance-calendar.csv", csv, "text/csv");
      },
    },
  ];

  return (
    <>
      <ContentHead title="Reports" subtitle={formatToday()} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
        {reports.map((r) => (
          <Card key={r.title}>
            <CardHeader title={r.title} />
            <CardBody className="flex flex-col gap-3">
              <p className="text-[0.82rem] text-ink-2">{r.description}</p>
              <Button
                variant="ghost"
                icon={<DownloadIcon className="h-3.75 w-3.75" />}
                disabled={r.disabled}
                onClick={r.download}
                className="self-start"
              >
                Download CSV
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
