import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OfficeHeadcount } from "@/lib/types";

const officeColors = ["var(--chart-bar)"];

export function HeadcountChart({ data }: { data: OfficeHeadcount[] }) {
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barSize={16}>
          <XAxis type="number" hide domain={[0, "dataMax + 20"]} />
          <YAxis
            type="category"
            dataKey="office"
            width={78}
            tick={{ fontSize: 12, fill: "var(--color-ink-2)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--nav-hover-bg)" }}
            formatter={(value) => [value, "Employees"]}
            contentStyle={{
              background: "var(--panel)",
              border: "1px solid var(--panel-border)",
              borderRadius: "var(--radius-dropdown)",
              boxShadow: "var(--shadow-panel)",
              backdropFilter: "var(--blur-panel)",
              WebkitBackdropFilter: "var(--blur-panel)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-ink-2)", fontWeight: 500 }}
            itemStyle={{ color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}
          />
          <Bar dataKey="count" radius={[0, 5, 5, 0]}>
            {data.map((entry, i) => (
              <Cell key={entry.office} fill={officeColors[i % officeColors.length]} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              style={{ fill: "var(--color-ink)", fontSize: 12, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
