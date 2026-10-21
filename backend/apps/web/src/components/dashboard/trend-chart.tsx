'use client';

import { formatDate, type DashboardSummary } from '@msma/shared';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Point = DashboardSummary['trend'][number];

const shortDate = (d: string) => formatDate(d).replace(/ \d{4}$/, '');

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{formatDate(p.date)}</p>
      <p className="mt-0.5">
        <span className="num font-semibold">{p.rate.toFixed(1)}%</span>{' '}
        <span className="text-muted">attendance</span>
      </p>
      <p className="text-muted">
        <span className="num">{p.present}</span> present of{' '}
        <span className="num">{p.scheduled}</span> scheduled
      </p>
    </div>
  );
}

/** Single-series line: attendance rate over the last 14 working days. */
export function TrendChart({ data }: { data: Point[] }) {
  const min = Math.min(...data.map((d) => d.rate), 100);
  const floor = Math.max(0, Math.floor((min - 3) / 5) * 5);
  return (
    <>
      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              domain={[floor, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }}
            />
            <Line
              type="linear"
              dataKey="rate"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--accent)', stroke: 'var(--card)', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: 'var(--accent)', stroke: 'var(--card)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Table view of the same data for screen readers */}
      <table className="sr-only">
        <caption>Attendance rate, last {data.length} working days</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Rate</th>
            <th>Present</th>
            <th>Scheduled</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{formatDate(d.date)}</td>
              <td>{d.rate}%</td>
              <td>{d.present}</td>
              <td>{d.scheduled}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
