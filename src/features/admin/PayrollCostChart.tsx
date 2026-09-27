import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PayrollCostSegment } from "@/lib/types";

const segmentColors: Record<PayrollCostSegment["label"], string> = {
  "Basic pay": "var(--color-cat-1)",
  Statutory: "var(--color-cat-2)",
  Allowances: "var(--color-cat-3)",
  Overtime: "var(--color-cat-4)",
};

export function PayrollCostChart({ data }: { data: PayrollCostSegment[] }) {
  const row: Record<string, string | number> = { name: "Payroll" };
  data.forEach((segment) => {
    row[segment.label] = segment.percent;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="h-9 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[row]} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
              formatter={(value, name) => [`${value}%`, name]}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {data.map((segment, i) => (
              <Bar
                key={segment.label}
                dataKey={segment.label}
                stackId="payroll"
                fill={segmentColors[segment.label]}
                radius={
                  i === 0
                    ? [5, 0, 0, 5]
                    : i === data.length - 1
                      ? [0, 5, 5, 0]
                      : [0, 0, 0, 0]
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-4 text-[0.76rem] text-ink-2">
        {data.map((segment) => (
          <span key={segment.label} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 flex-none rounded-[3px]"
              style={{ background: segmentColors[segment.label] }}
            />
            {segment.label} {"·"} {segment.percent}%
          </span>
        ))}
      </div>
    </div>
  );
}
