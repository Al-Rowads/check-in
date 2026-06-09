import logoUrl from "../../assets/logo.png";
import { cn } from "../../lib/cn";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ compact = false, className }: BrandMarkProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <img
        alt=""
        aria-hidden="true"
        className="h-11 w-11 shrink-0 object-contain drop-shadow-[0_10px_22px_rgb(232_80_2/0.26)]"
        src={logoUrl}
      />
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-semibold tracking-[0.08em] text-alrowad-white",
            compact ? "text-lg" : "text-2xl sm:text-3xl",
          )}
        >
          AL-ROWADs
        </p>
        {!compact ? (
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/48">
            Check-in console
          </p>
        ) : null}
      </div>
    </div>
  );
}
