import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface Series {
  /** Data key for this series. */
  key: string;
  /** Legend/tooltip label. */
  label?: string;
  /** CSS color; defaults to a themed palette slot (--deck-*). */
  color?: string;
}

export interface BarChartProps {
  data: Record<string, string | number>[];
  /** Category (x-axis) key. */
  x: string;
  series: Series[];
  height?: number;
  /** Hide the y-axis. */
  hideY?: boolean;
}

// Palette classes set `color`; bars use fill="currentColor" so they follow the
// theme (--deck-*) — CSS var() doesn't resolve in raw SVG fill attributes.
const PALETTE = ["deck-rc-0", "deck-rc-1", "deck-rc-2", "deck-rc-3", "deck-rc-4"];

export default function BarChart({ data, x, series, height = 380, hideY = false }: BarChartProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--deck-line)" />
          <XAxis
            dataKey={x}
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            tick={{ fill: "var(--deck-faint)", fontSize: 22 }}
          />
          {!hideY && (
            <YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: "var(--deck-faint)", fontSize: 20 }} />
          )}
          <Tooltip
            cursor={{ fill: "color-mix(in oklab, var(--deck-fg) 7%, transparent)" }}
            contentStyle={{
              background: "var(--deck-panel-2)",
              border: "1px solid var(--deck-line-strong)",
              borderRadius: 12,
              color: "var(--deck-fg)",
              fontSize: 20,
            }}
            labelStyle={{ color: "var(--deck-muted)" }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label ?? s.key}
              className={PALETTE[i % PALETTE.length]}
              fill="currentColor"
              style={s.color ? { color: s.color } : undefined}
              radius={[8, 8, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
