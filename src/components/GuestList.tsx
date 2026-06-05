import type { CheckInState, Guest } from "../types/guest";
import { CheckInBadge, PaymentBadge, StatusBadge } from "./Badge";
import { GuestActions } from "./GuestActions";

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
      <div className="rounded-md border border-dashed border-stone-300 bg-white/70 px-4 py-8 text-center">
        <p className="font-bold text-stone-900">{emptyTitle}</p>
        <p className="mt-1 text-sm text-stone-600">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm">
      {layout === "table" ? (
        <div className="hidden grid-cols-[minmax(14rem,1.4fr)_minmax(9rem,0.8fr)_minmax(15rem,1.1fr)_minmax(17rem,1fr)] gap-4 border-b border-stone-200 bg-stone-50 px-4 py-3 text-xs font-bold uppercase text-stone-500 lg:grid">
          <span>Guest</span>
          <span>Phone</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
      ) : null}

      <div className="divide-y divide-stone-200">
        {guests.map((guest) => (
          <article
            className={
              layout === "table"
                ? "grid gap-4 px-4 py-4 lg:grid-cols-[minmax(14rem,1.4fr)_minmax(9rem,0.8fr)_minmax(15rem,1.1fr)_minmax(17rem,1fr)] lg:items-center"
                : "grid gap-3 px-4 py-4"
            }
            key={guest.id}
          >
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-stone-950">{guest.name}</h3>
              {guest.amountPaid !== undefined && guest.amountPaid !== "" ? (
                <p className="mt-1 text-sm text-stone-600">Value: {guest.amountPaid}</p>
              ) : null}
            </div>

            <p className="break-words text-sm font-semibold text-stone-700">{guest.phoneNumber}</p>

            <div className="flex flex-wrap gap-2">
              <StatusBadge status={guest.status} />
              <PaymentBadge payment={guest.payment} />
              <CheckInBadge state={guest.checkInState} />
            </div>

            <GuestActions
              guest={guest}
              isMarkingEntered={isCheckInActionPending(guest.id, "entered")}
              onMarkPaid={onMarkPaid}
              onStateChange={onStateChange}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
