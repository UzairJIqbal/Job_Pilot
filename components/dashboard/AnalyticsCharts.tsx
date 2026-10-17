"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

export type ChartData = {
  jobsFoundData: { date: string; count: number }[];
  matchScoreData: { range: string; count: number }[];
  companyResearchData: { date: string; count: number }[];
};

type AnalyticsChartsProps = {
  jobsFoundData: ChartData["jobsFoundData"];
  matchScoreData: ChartData["matchScoreData"];
  companyResearchData: ChartData["companyResearchData"];
};

function formatDayLabel(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const gridStyle = {
  strokeDasharray: "3 3",
  stroke: "var(--color-border)",
  strokeWidth: 1,
};

const axisStyle = {
  fontSize: 12,
  fontFamily: "var(--font-sans)",
  fill: "var(--color-text-muted)",
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

export function AnalyticsCharts({
  jobsFoundData,
  matchScoreData,
  companyResearchData,
}: AnalyticsChartsProps) {
  const hasJobsData = jobsFoundData.length > 0;
  const hasScoreData = matchScoreData.some((d) => d.count > 0);
  const hasResearchData = companyResearchData.length > 0;

  const formattedJobsData = jobsFoundData.map((d) => ({
    ...d,
    label: formatDayLabel(d.date),
  }));

  const formattedResearchData = companyResearchData.map((d) => ({
    ...d,
    label: formatDayLabel(d.date),
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Company Research Activity */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          Company Research Activity
        </h3>
        {hasResearchData ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={formattedResearchData}>
              <CartesianGrid {...gridStyle} />
              <XAxis
                dataKey="label"
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Bar dataKey="count" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="No research activity yet — try researching a company from a job details page." />
        )}
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-6">
        {/* Jobs Found Over Time */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">
            Jobs Found Over Time
          </h3>
          {hasJobsData ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={formattedJobsData}>
                <defs>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis
                  dataKey="label"
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  fill="url(#purpleGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No jobs found yet — start searching for jobs." />
          )}
        </div>

        {/* Match Score Distribution */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">
            Match Score Distribution
          </h3>
          {hasScoreData ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={matchScoreData}>
                <CartesianGrid {...gridStyle} />
                <XAxis
                  dataKey="range"
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Bar dataKey="count" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No match data yet — jobs will appear after your first search." />
          )}
        </div>
      </div>
    </div>
  );
}
