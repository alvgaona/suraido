// React chart components (Recharts). Use as Astro islands:
//   import { BarChart } from "suraido/react";
//   <BarChart client:only="react" x="month" series={[{ key: "sales" }]} data={data} />
// Requires @astrojs/react in the consumer's astro.config.
export { default as BarChart } from "./BarChart.tsx";
export type { BarChartProps, Series } from "./BarChart.tsx";
