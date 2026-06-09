import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type StatTileTone = "orange" | "blue" | "neutral" | "success" | "warning" | "danger";

type StatTileProps = {
  detail?: string;
  icon?: ReactNode;
  label: string;
  tone?: StatTileTone;
  value: number | string;
};

const toneClasses: Record<StatTileTone, string> = {
  orange: "border-alrowad-orange/34 bg-alrowad-orange/12 text-alrowad-orange",
  blue: "border-alrowad-blue/45 bg-alrowad-blue/24 text-blue-100",
  neutral: "border-white/10 bg-white/[0.045] text-white/68",
  success: "border-emerald-400/28 bg-emerald-400/10 text-emerald-100",
  warning: "border-alrowad-flame/30 bg-alrowad-flame/12 text-orange-100",
  danger: "border-alrowad-red/36 bg-alrowad-red/14 text-red-100",
};

export function StatTile({
  detail,
  icon,
  label,
  tone = "neutral",
  value,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "min-h-28 rounded-lg border p-4 shadow-inset",
        toneClasses[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white/62">{label}</p>
        {icon ? <span className="shrink-0">{icon}</span> : null}
      </div>
      <p className="mt-4 text-3xl font-semibold leading-none text-alrowad-white">{value}</p>
      {detail ? <p className="mt-2 text-xs font-semibold text-white/42">{detail}</p> : null}
    </div>
  );
}
