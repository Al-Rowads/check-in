import type { DashboardStats as DashboardStatsType } from "../types/guest";

type DashboardStatsProps = {
  stats: DashboardStatsType;
};

const statLabels: Array<{
  key: keyof DashboardStatsType;
  label: string;
  accent: string;
}> = [
  { key: "totalRegistered", label: "Registered", accent: "border-l-teal-600" },
  { key: "totalEntered", label: "Entered", accent: "border-l-emerald-600" },
  { key: "enteredVip", label: "Entered VIP", accent: "border-l-amber-500" },
  { key: "enteredNormal", label: "Entered normal", accent: "border-l-sky-500" },
  { key: "totalLeft", label: "Left", accent: "border-l-stone-500" },
  { key: "notEntered", label: "Not entered", accent: "border-l-orange-500" },
  { key: "totalVip", label: "VIP registered", accent: "border-l-amber-400" },
  { key: "totalNormal", label: "Normal registered", accent: "border-l-sky-400" },
  { key: "incompletePayment", label: "Incomplete payment", accent: "border-l-rose-500" },
];

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <section aria-labelledby="dashboard-heading" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">
            Live desk
          </p>
          <h2 className="text-2xl font-bold text-stone-950" id="dashboard-heading">
            Dashboard
          </h2>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statLabels.map((stat) => (
          <div
            className={`min-h-28 rounded-md border border-stone-200 border-l-4 bg-white p-4 shadow-sm ${stat.accent}`}
            key={stat.key}
          >
            <p className="text-sm font-semibold text-stone-600">{stat.label}</p>
            <p className="mt-3 text-3xl font-bold text-stone-950">{stats[stat.key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
