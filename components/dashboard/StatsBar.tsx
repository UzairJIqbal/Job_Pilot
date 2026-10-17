"use client";

import { BriefcaseIcon, Target, Building2, Calendar, Send } from "lucide-react";

export type DashboardStats = {
  totalJobs: number;
  avgMatchRate: number;
  companiesResearched: number;
  jobsThisWeek: number;
  appliedCount: number;
};

type Stat = {
  label: string;
  value: string;
  icon: React.ElementType;
};

export function StatsBar({ stats }: { stats: DashboardStats }) {
  const statItems: Stat[] = [
    {
      label: "Total Jobs Found",
      value: String(stats.totalJobs),
      icon: BriefcaseIcon,
    },
    {
      label: "Avg. Match Rate",
      value: `${stats.avgMatchRate}%`,
      icon: Target,
    },
    {
      label: "Companies Researched",
      value: String(stats.companiesResearched),
      icon: Building2,
    },
    {
      label: "Jobs This Week",
      value: String(stats.jobsThisWeek),
      icon: Calendar,
    },
    {
      label: "Applications Sent",
      value: String(stats.appliedCount),
      icon: Send,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {statItems.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-surface p-5 shadow-card"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-accent/10 p-3">
                  <Icon className="h-5 w-5 text-accent" strokeWidth={2} />
                </div>
                <span className="text-xs font-medium text-text-muted">
                  {stat.label}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-semibold text-text-primary">
                {stat.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
