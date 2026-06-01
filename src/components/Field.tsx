import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

type FieldProps = {
  label: string;
  children: ReactNode;
};

export function Field({ label, children }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-stone-800">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...props }, ref) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-950 shadow-sm transition placeholder:text-stone-400 hover:border-stone-400",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
  },
);
