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
  neutral: "border-white/12 bg-white/[0.055] text-white/68",
  vip: "border-alrowad-blue/50 bg-alrowad-blue/30 text-blue-100",
  normal: "border-white/12 bg-white/[0.07] text-white/74",
  success: "border-emerald-400/30 bg-emerald-400/12 text-emerald-100",
  warning: "border-alrowad-flame/30 bg-alrowad-flame/12 text-orange-100",
  muted: "border-white/10 bg-transparent text-white/48",
  danger: "border-alrowad-red/36 bg-alrowad-red/14 text-red-100",
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
