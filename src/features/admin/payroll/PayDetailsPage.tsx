import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { DownloadIcon } from "@/components/icons";
import { downloadTextFile, toCsv } from "@/lib/download";
import { listPayDetails, type PayDetail } from "@/lib/pay/details";
import { LoadError, Pill } from "../corehr/ui";
import { Choice, SearchBox, SimpleTable, Toolbar } from "../timekeeping/common";

const peso = (n: number) => (n ? `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—");
const shortDate = (iso?: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "");
const num = (v: string) => (v ? <span className="font-num">{v}</span> : <Pill tone="warn">Missing</Pill>);

/** Payroll → Pay details: salary, employment status and government numbers, without the 201 file. */
export function PayDetailsPage() {
  const list = useQuery({ queryKey: ["payroll", "pay-details"], queryFn: listPayDetails, staleTime: 0 });
  const [query, setQuery] = useState("");
  const [show, setShow] = useState("all");
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;

  const all = list.data ?? [];
  const incomplete = all.filter((p) => p.missing.length > 0).length;
  const noBank = all.filter((p) => !p.bank).length;
  const q = query.trim().toLowerCase();
  const rows = all.filter((p) => (show === "all" || (show === "missing" ? p.missing.length > 0 : !p.bank)) && (!q || `${p.name} ${p.id} ${p.department}`.toLowerCase().includes(q)));

  const download = () =>
    downloadTextFile(
      "pay-details.csv",
      toCsv(all.map((p) => ({ "Employee ID": p.id, Name: p.name, Position: p.position, Department: p.department, Office: p.office, Type: p.employmentType, Status: p.status, Hired: p.dateHired, Separated: p.separationDate ?? "", "Monthly salary": p.monthlySalary, TIN: p.tin, SSS: p.sss, PhilHealth: p.philhealth, "Pag-IBIG": p.pagibig, Bank: p.bank?.bank ?? "", "Account name": p.bank?.accountName ?? "", "Account number": p.bank?.accountNumber ?? "" }))),
      "text/csv",
    );

  return (
    <>
      <ContentHead
        title="Pay details"
        subtitle={incomplete ? `${all.length} employees · ${incomplete} missing a government number payroll needs` : `${all.length} employees, with the details payroll needs.`}
        actions={
          <Button icon={<DownloadIcon className="h-4 w-4" />} disabled={!all.length} onClick={download}>
            Download CSV
          </Button>
        }
      />
      <Toolbar>
        <Choice
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: "Everyone" },
            { value: "missing", label: `Missing numbers (${incomplete})` },
            { value: "nobank", label: `No bank account (${noBank})` },
          ]}
        />
        <SearchBox value={query} onChange={setQuery} placeholder="Search name, ID or department" />
      </Toolbar>
      <SimpleTable<PayDetail>
        rows={rows}
        rowKey={(p) => p.id}
        loading={list.isLoading}
        empty={show === "missing" ? "Everyone has their government numbers." : show === "nobank" ? "Everyone has a bank account." : "No employees match."}
        cols={[
          {
            header: "Employee",
            cell: (p) => (
              <span>
                <span className="block font-medium">{p.name}</span>
                <span className="block text-xs text-ink-2">
                  {p.id} · {p.position}
                </span>
              </span>
            ),
          },
          {
            header: "Department",
            cell: (p) => (
              <span>
                <span className="block">{p.department || "—"}</span>
                <span className="block text-xs text-ink-2">{p.office}</span>
              </span>
            ),
          },
          {
            header: "Status",
            cell: (p) => (
              <span>
                <span className="block">{p.status === "Separated" ? `Left ${shortDate(p.separationDate)}` : p.status}</span>
                <span className="block text-xs text-ink-2">
                  {p.employmentType} · hired {shortDate(p.dateHired)}
                </span>
              </span>
            ),
          },
          {
            header: "Bank account",
            cell: (p) =>
              p.bank ? (
                <span>
                  <span className="block">{p.bank.bank}</span>
                  <span className="font-num block text-xs text-ink-2">{p.bank.accountNumber}</span>
                </span>
              ) : (
                <Pill tone="warn">Missing</Pill>
              ),
          },
          { header: "Monthly salary", align: "right", cell: (p) => <span className="font-num font-medium">{peso(p.monthlySalary)}</span> },
          {
            header: "Government numbers",
            cell: (p) => (
              <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-xs">
                {([["TIN", p.tin], ["SSS", p.sss], ["PhilHealth", p.philhealth], ["Pag-IBIG", p.pagibig]] as const).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-2">{k}</dt>
                    <dd>{num(v)}</dd>
                  </div>
                ))}
              </dl>
            ),
          },
        ]}
      />
    </>
  );
}
