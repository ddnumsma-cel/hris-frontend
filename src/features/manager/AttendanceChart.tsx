import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AttendancePoint } from "@/lib/types";

/**
 * "area" (default) is the trend line used on the attendance page; "bars" is the
 * dashboard hero style — the latest day in the accent color, earlier days muted.
 */
export function AttendanceChart({ data, variant = "area" }: { data: AttendancePoint[]; variant?: "area" | "bars" }) {
  if (variant === "bars") {
    return (
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="18%">
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--color-ink-2)" }}
              axisLine={false}
              tickLine={false}
              interval={1}
            />
            <YAxis
              domain={[80, 100]}
              ticks={[80, 90, 100]}
              tick={{ fontSize: 11, fill: "var(--color-ink-2)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
              width={40}
            />
            <Tooltip
              cursor={{ fill: "var(--color-surface-2)", radius: 8 }}
              formatter={(value) => [`${value}%`, "On-time rate"]}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                boxShadow: "0 8px 24px -12px rgba(2, 24, 80, 0.35)",
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-ink-2)", fontWeight: 500 }}
              itemStyle={{ color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}
            />
            <Bar dataKey="rate" radius={[8, 8, 8, 8]}>
              {data.map((point, i) => (
                <Cell
                  key={point.date}
                  fill={i === data.length - 1 ? "var(--dash-accent, var(--color-brand))" : "var(--dash-bar-idle, var(--color-surface-2))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-45 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-ink-3)" }}
            axisLine={false}
            tickLine={false}
            interval={2}
          />
          <YAxis
            domain={[80, 100]}
            ticks={[80, 90, 100]}
            tick={{ fontSize: 11, fill: "var(--color-ink-3)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
            width={40}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, "On-time rate"]}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-ink-2)", fontWeight: 600 }}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--color-brand)"
            strokeWidth={2.5}
            fill="url(#attendanceFill)"
            activeDot={{ r: 4.5 }}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              if (index !== data.length - 1 || cx === undefined || cy === undefined) {
                return <g key={`dot-${index}`} />;
              }
              return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4.5} fill="var(--color-brand)" />;
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
