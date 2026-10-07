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
            <defs>
              <linearGradient id="attendanceHighlight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-highlight-top)" />
                <stop offset="100%" stopColor="var(--chart-highlight-bottom)" />
              </linearGradient>
            </defs>
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
              cursor={{ fill: "var(--nav-hover-bg)", radius: 8 }}
              formatter={(value) => [`${value}%`, "On-time rate"]}
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
            <Bar dataKey="rate" radius={[8, 8, 8, 8]}>
              {data.map((point, i) => (
                <Cell
                  key={point.date}
                  fill={i === data.length - 1 ? "url(#attendanceHighlight)" : "var(--chart-bar)"}
                  style={i === data.length - 1 ? { filter: "var(--chart-highlight-glow)" } : undefined}
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
              <stop offset="0%" stopColor="var(--chart-bar)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--chart-bar)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="attendanceDot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-highlight-top)" />
              <stop offset="100%" stopColor="var(--chart-highlight-bottom)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" vertical={false} />
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
              background: "var(--panel)",
              border: "1px solid var(--panel-border)",
              borderRadius: "var(--radius-dropdown)",
              boxShadow: "var(--shadow-panel)",
              backdropFilter: "var(--blur-panel)",
              WebkitBackdropFilter: "var(--blur-panel)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-ink-2)", fontWeight: 600 }}
            itemStyle={{ color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--chart-bar)"
            strokeWidth={2.5}
            fill="url(#attendanceFill)"
            activeDot={{ r: 4.5 }}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              if (index !== data.length - 1 || cx === undefined || cy === undefined) {
                return <g key={`dot-${index}`} />;
              }
              return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4.5} fill="url(#attendanceDot)" style={{ filter: "var(--chart-highlight-glow)" }} />;
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
