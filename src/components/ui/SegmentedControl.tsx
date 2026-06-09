import { cn } from "../../lib/cn";

type SegmentedOption<TValue extends string> = {
  label: string;
  meta?: number | string;
  tone?: "default" | "danger" | "blue";
  value: TValue;
};

type SegmentedControlProps<TValue extends string> = {
  ariaLabel: string;
  onChange: (value: TValue) => void;
  options: Array<SegmentedOption<TValue>>;
  value: TValue;
};

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto rounded-lg border border-white/10 bg-black/35 p-1 shadow-inset"
      role="group"
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        const tone = option.tone ?? "default";

        return (
          <button
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition",
              isSelected && tone === "danger"
                ? "border-alrowad-red bg-alrowad-red text-alrowad-white shadow-orange"
                : false,
              isSelected && tone === "blue"
                ? "border-alrowad-blue bg-alrowad-blue text-alrowad-white"
                : false,
              isSelected && tone === "default"
                ? "border-alrowad-orange bg-alrowad-orange text-alrowad-white shadow-orange"
                : false,
              !isSelected
                ? "border-transparent bg-transparent text-white/64 hover:bg-white/8 hover:text-alrowad-white"
                : false,
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <span>{option.label}</span>
            {option.meta !== undefined ? (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-xs",
                  isSelected ? "bg-black/18 text-white" : "bg-white/8 text-white/62",
                )}
              >
                {option.meta}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
