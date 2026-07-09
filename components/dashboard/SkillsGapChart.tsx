"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export type SkillsGapData = { skill: string; count: number }[];

type SkillsGapChartProps = {
  skills: SkillsGapData;
};

const gridStyle = {
  strokeDasharray: "3 3",
  stroke: "var(--color-border)",
  strokeWidth: 1,
};

const axisStyle = {
  fontSize: 12,
  fontFamily: "Inter, sans-serif",
  fill: "var(--color-text-muted)",
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

export function SkillsGapChart({ skills }: SkillsGapChartProps) {
  const hasData = skills.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">
        Top Missing Skills
      </h3>
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={skills} layout="vertical">
            <CartesianGrid {...gridStyle} />
            <XAxis
              type="number"
              tick={axisStyle}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="skill"
              tick={axisStyle}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Bar
              dataKey="count"
              fill="var(--color-warning)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart message="No missing skills data yet — jobs will show skill gaps after your first search." />
      )}
    </div>
  );
}
