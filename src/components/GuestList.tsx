import type { CheckInState, Guest } from "../types/guest";
import { Phone, SearchX } from "lucide-react";
import { CheckInBadge, PaymentBadge, StatusBadge } from "./Badge";
import { GuestActions } from "./GuestActions";
import { cn } from "../lib/cn";
import { EmptyState } from "./ui";

type GuestListProps = {
  guests: Guest[];
  emptyTitle: string;
  emptyDescription: string;
  layout?: "table" | "compact";
  isCheckInActionPending: (guestId: string, nextState: CheckInState) => boolean;
  onStateChange: (guestId: string, nextState: CheckInState) => void;
  onMarkPaid: (guestId: string) => void;
};

export function GuestList({
  guests,
  emptyTitle,
  emptyDescription,
  layout = "table",
  isCheckInActionPending,
  onMarkPaid,
  onStateChange,
}: GuestListProps) {
  if (guests.length === 0) {
    return (
      <EmptyState
        description={emptyDescription}
        icon={<SearchX aria-hidden="true" className="size-6" />}
        title={emptyTitle}
      />
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border shadow-soft",
        layout === "compact"
          ? "border-alrowad-orange/24 bg-[#090909]"
          : "border-white/10 bg-[#0D0D0D]",
      )}
    >
      {layout === "table" ? (
        <div className="hidden grid-cols-[minmax(14rem,1.4fr)_minmax(9rem,0.8fr)_minmax(15rem,1.1fr)_minmax(17rem,1fr)] gap-4 border-b border-white/10 bg-white/[0.045] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white/42 lg:grid">
          <span>Guest</span>
          <span>Phone</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
      ) : null}

      <div className="divide-y divide-white/8">
        {guests.map((guest) => (
          <article
            className={cn(
              "transition hover:bg-white/[0.035]",
              layout === "table"
                ? "grid gap-4 px-4 py-4 lg:grid-cols-[minmax(14rem,1.4fr)_minmax(9rem,0.8fr)_minmax(15rem,1.1fr)_minmax(17rem,1fr)] lg:items-center"
                : "grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5",
              guest.checkInState === "entered"
                ? "border-l-2 border-l-emerald-400"
                : guest.checkInState === "left"
                  ? "border-l-2 border-l-white/20"
                  : "border-l-2 border-l-alrowad-orange",
            )}
            key={guest.id}
          >
            <div className="flex min-w-0 gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.055] text-sm font-bold text-alrowad-white">
                {getGuestInitials(guest.name)}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-alrowad-white">
                    {guest.name}
                  </h3>
                  {layout === "compact" ? <StatusBadge status={guest.status} /> : null}
                </div>
                {guest.amountPaid !== undefined && guest.amountPaid !== "" ? (
                  <p className="mt-1 text-sm text-white/48">Value: {guest.amountPaid}</p>
                ) : null}
              </div>
            </div>

            <p className="flex min-w-0 items-center gap-2 break-words text-sm font-semibold text-white/62">
              {layout === "compact" ? (
                <Phone aria-hidden="true" className="size-4 shrink-0 text-white/36" />
              ) : null}
              <span>{guest.phoneNumber}</span>
            </p>

            <div className="flex flex-wrap gap-2">
              {layout === "table" ? <StatusBadge status={guest.status} /> : null}
              <PaymentBadge payment={guest.payment} />
              <CheckInBadge state={guest.checkInState} />
            </div>

            <GuestActions
              guest={guest}
              isMarkingEntered={isCheckInActionPending(guest.id, "entered")}
              isResetting={isCheckInActionPending(guest.id, "not_entered")}
              onMarkPaid={onMarkPaid}
              onStateChange={onStateChange}
            />
          </article>
        ))}
      </div>
    </div>
  );
}

function getGuestInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .filter(Boolean)
    .join("");

  return initials || "?";
}
