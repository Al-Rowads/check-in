import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type SectionHeaderProps = {
  action?: ReactNode;
  className?: string;
  description?: string;
  eyebrow: string;
  icon?: ReactNode;
  title: string;
  titleId?: string;
};

export function SectionHeader({
  action,
  className,
  description,
  eyebrow,
  icon,
  title,
  titleId,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-alrowad-orange">
          {icon ? <span className="text-alrowad-orange">{icon}</span> : null}
          <span>{eyebrow}</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-alrowad-white" id={titleId}>
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/58">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
