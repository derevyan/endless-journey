import { formatRelativeTime } from "@/shared/lib/utils/date-utils";
import { cn } from "@/shared/lib/utils";

interface ProfileStatsProps {
  platform: string;
  totalSessions: number;
  lastActiveAt: Date | null;
  createdAt?: Date | null;
  className?: string;
}

export function ProfileStats({
  platform,
  totalSessions,
  lastActiveAt,
  createdAt,
  className,
}: ProfileStatsProps) {
  const stats = [
    {
      label: "Platform",
      value: platform.charAt(0).toUpperCase() + platform.slice(1),
    },
    {
      label: "Sessions",
      value: totalSessions.toString(),
    },
    {
      label: "Last active",
      value: lastActiveAt ? formatRelativeTime(lastActiveAt) : "Never",
    },
    {
      label: "First seen",
      value: createdAt ? formatRelativeTime(createdAt) : "Unknown",
    },
  ];

  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 flex flex-col">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium truncate mb-0.5 opacity-80">
             {stat.label}
          </p>
          <p className="text-xs font-semibold truncate text-foreground/90 leading-tight" title={stat.value}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
