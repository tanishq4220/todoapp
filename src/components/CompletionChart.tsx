import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CompletionDay {
  date: string;
  label: string;
  count: number;
}

export default function CompletionChart({ data }: { data: CompletionDay[] }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="completion-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#658575" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#658575" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              color: "var(--ink)",
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#527765"
            strokeWidth={2.5}
            fill="url(#completion-fill)"
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}