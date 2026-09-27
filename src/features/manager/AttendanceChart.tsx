import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AttendancePoint } from "@/lib/types";

export function AttendanceChart({ data }: { data: AttendancePoint[] }) {
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
