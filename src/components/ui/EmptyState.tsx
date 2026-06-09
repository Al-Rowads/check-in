import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { cn } from "../../lib/cn";

type EmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description: string;
  icon?: ReactNode;
  title: string;
};

export function EmptyState({
  action,
  className,
  description,
  icon,
  title,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-lg border border-dashed border-white/14 bg-white/[0.035] px-4 py-10 text-center shadow-inset",
        className,
      )}
    >
      <div className="grid max-w-sm justify-items-center gap-3">
        <div className="grid size-12 place-items-center rounded-md border border-alrowad-orange/25 bg-alrowad-orange/10 text-alrowad-orange">
          {icon ?? <SearchX aria-hidden="true" className="size-6" />}
        </div>
        <div>
          <p className="font-semibold text-alrowad-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-white/55">{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}
