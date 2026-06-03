import type { ReactNode } from "react";
import type { CheckInState, GuestStatus, PaymentStatus } from "../types/guest";
import { cn } from "../lib/cn";

type BadgeTone = "neutral" | "vip" | "normal" | "success" | "warning" | "muted" | "danger";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-stone-300 bg-stone-100 text-stone-700",
  vip: "border-amber-300 bg-amber-100 text-amber-900",
  normal: "border-sky-200 bg-sky-100 text-sky-800",
  success: "border-emerald-200 bg-emerald-100 text-emerald-800",
  warning: "border-orange-200 bg-orange-100 text-orange-800",
  muted: "border-stone-200 bg-white text-stone-600",
  danger: "border-rose-200 bg-rose-100 text-rose-800",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-bold",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: GuestStatus }) {
  return <Badge tone={status === "VIP" ? "vip" : "normal"}>{status}</Badge>;
}

export function PaymentBadge({ payment }: { payment: PaymentStatus }) {
  return (
    <Badge tone={payment === "full" ? "success" : "danger"}>
      {payment === "full" ? "Paid in full" : "Not fully paid"}
    </Badge>
  );
}

export function CheckInBadge({ state }: { state: CheckInState }) {
  if (state === "entered") {
    return <Badge tone="success">Entered</Badge>;
  }

  if (state === "left") {
    return <Badge tone="muted">Left</Badge>;
  }

  return <Badge tone="neutral">Not entered</Badge>;
}
