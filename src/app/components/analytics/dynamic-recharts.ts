'use client';

import type { ComponentType , ReactNode } from 'react';
import dynamic from 'next/dynamic';

type DynamicChartProps = {
  children?: ReactNode;
  [key: string]: unknown;
};

function rechartsComponent(
  loader: () => Promise<ComponentType<DynamicChartProps>>,
) {
  return dynamic(loader, { ssr: false }) as ComponentType<DynamicChartProps>;
}

const loadRechartsComponent = async (name: string) => {
  const mod = await import('recharts');
  return mod[name as keyof typeof mod] as ComponentType<DynamicChartProps>;
};

export const Area = rechartsComponent(() => loadRechartsComponent('Area'));
export const AreaChart = rechartsComponent(() => loadRechartsComponent('AreaChart'));
export const Bar = rechartsComponent(() => loadRechartsComponent('Bar'));
export const BarChart = rechartsComponent(() => loadRechartsComponent('BarChart'));
export const CartesianGrid = rechartsComponent(() => loadRechartsComponent('CartesianGrid'));
export const Cell = rechartsComponent(() => loadRechartsComponent('Cell'));
export const Legend = rechartsComponent(() => loadRechartsComponent('Legend'));
export const Line = rechartsComponent(() => loadRechartsComponent('Line'));
export const LineChart = rechartsComponent(() => loadRechartsComponent('LineChart'));
export const Pie = rechartsComponent(() => loadRechartsComponent('Pie'));
export const PieChart = rechartsComponent(() => loadRechartsComponent('PieChart'));
export const ResponsiveContainer = rechartsComponent(() =>
  loadRechartsComponent('ResponsiveContainer')
);
export const Tooltip = rechartsComponent(() => loadRechartsComponent('Tooltip'));
export const XAxis = rechartsComponent(() => loadRechartsComponent('XAxis'));
export const YAxis = rechartsComponent(() => loadRechartsComponent('YAxis'));
