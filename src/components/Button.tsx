import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type ButtonVariant = "primary" | "secondary" | "surface" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  icon?: ReactNode;
  isLoading?: boolean;
  rightIcon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-alrowad-orange bg-alrowad-orange text-alrowad-white shadow-orange hover:border-alrowad-flame hover:bg-alrowad-flame",
  secondary:
    "border-white/14 bg-white/[0.075] text-alrowad-white hover:border-white/22 hover:bg-white/[0.11]",
  surface:
    "border-white/10 bg-[#151515] text-alrowad-white hover:border-alrowad-orange/35 hover:bg-[#1C1C1C]",
  ghost: "border-transparent bg-transparent text-white/68 hover:bg-white/8 hover:text-alrowad-white",
  danger:
    "border-alrowad-red bg-alrowad-red text-alrowad-white hover:border-alrowad-flame hover:bg-alrowad-flame",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-14 px-5 text-base",
};

export function Button({
  children,
  className,
  icon,
  isLoading = false,
  rightIcon,
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
      {!isLoading && rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
    </button>
  );
}
