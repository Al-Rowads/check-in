import type { DashboardStats as DashboardStatsType } from "../types/guest";
import { AlertCircle, CheckCircle2, Crown, LogOut, UserRound, Users } from "lucide-react";
import { SectionHeader, StatTile } from "./ui";

type DashboardStatsProps = {
  stats: DashboardStatsType;
};

const statLabels: Array<{
  key: keyof DashboardStatsType;
  label: string;
  detail?: string;
  icon: typeof Users;
  tone: "orange" | "blue" | "neutral" | "success" | "warning" | "danger";
}> = [
  { key: "totalRegistered", label: "Registered", icon: Users, tone: "neutral" },
  { key: "totalEntered", label: "Entered", icon: CheckCircle2, tone: "orange" },
  { key: "notEntered", label: "Waiting", icon: UserRound, tone: "warning" },
  { key: "enteredVip", label: "VIP entered", icon: Crown, tone: "blue" },
  { key: "totalLeft", label: "Left", icon: LogOut, tone: "neutral" },
  { key: "incompletePayment", label: "Payment due", icon: AlertCircle, tone: "danger" },
];

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <section aria-labelledby="dashboard-heading" className="grid gap-4">
      <SectionHeader
        description="Live attendance signal for the active roster."
        eyebrow="Live desk"
        icon={<CheckCircle2 aria-hidden="true" className="size-4" />}
        title="Dashboard"
        titleId="dashboard-heading"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statLabels.map((stat) => {
          const Icon = stat.icon;

          return (
            <StatTile
              icon={<Icon aria-hidden="true" className="size-5" />}
              key={stat.key}
              label={stat.label}
              tone={stat.tone}
              value={stats[stat.key]}
            />
          );
        })}
      </div>
    </section>
  );
}
