import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

type FieldProps = {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
};

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="grid gap-2">
      <label className="grid gap-2 text-sm font-semibold text-white/76">
        <span>{label}</span>
        {children}
      </label>
      {hint ? <p className="text-xs font-semibold text-white/42">{hint}</p> : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...props }, ref) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-md border border-white/12 bg-black/35 px-3 text-base text-alrowad-white shadow-inset transition placeholder:text-white/30 hover:border-white/22",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
  },
);
