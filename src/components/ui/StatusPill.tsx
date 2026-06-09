import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type StatusTone = "neutral" | "orange" | "success" | "warning" | "danger" | "blue";

type StatusPillProps = {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  tone?: StatusTone;
};

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-white/12 bg-white/[0.055] text-white/74",
  orange: "border-alrowad-orange/40 bg-alrowad-orange/14 text-alrowad-white",
  success: "border-emerald-400/30 bg-emerald-400/12 text-emerald-100",
  warning: "border-alrowad-flame/35 bg-alrowad-flame/12 text-orange-100",
  danger: "border-alrowad-red/40 bg-alrowad-red/16 text-red-100",
  blue: "border-alrowad-blue/50 bg-alrowad-blue/28 text-blue-100",
};

export function StatusPill({
  children,
  className,
  icon,
  tone = "neutral",
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold shadow-inset",
        toneClasses[tone],
        className,
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
