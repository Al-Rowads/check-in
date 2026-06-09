import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type PanelTone = "default" | "accent" | "muted";

type PanelProps = {
  children: ReactNode;
  className?: string;
  tone?: PanelTone;
};

const toneClasses: Record<PanelTone, string> = {
  default: "border-white/10 bg-[#0D0D0D]/94 shadow-soft",
  accent:
    "border-alrowad-orange/30 bg-[linear-gradient(135deg,rgb(232_80_2/0.16),rgb(13_13_13/0.95)_34%,rgb(0_0_0/0.98))] shadow-console",
  muted: "border-white/8 bg-white/[0.045] shadow-soft",
};

export function Panel({ children, className, tone = "default" }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 shadow-inset sm:p-5",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
