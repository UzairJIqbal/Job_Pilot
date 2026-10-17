import { timeAgo } from "@/lib/utils";

export type Activity = {
  id: string;
  text: string;
  timestamp: string;
  type: "search" | "research";
};

const dotColors: Record<Activity["type"], string> = {
  search: "bg-success",
  research: "bg-accent",
};

export function RecentActivity({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          Recent Activity
        </h3>
        <p className="text-sm text-text-muted">
          No activity yet. Start by searching for jobs.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">
        Recent Activity
      </h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center gap-3">
            <div className="flex h-4 w-4 items-center justify-center">
              <div
                className={`h-3 w-3 rounded-full ${dotColors[activity.type]}`}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-text-primary">{activity.text}</p>
            </div>
            <span className="whitespace-nowrap text-xs text-text-muted">
              {timeAgo(activity.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
