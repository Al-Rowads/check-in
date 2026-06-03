import { useMemo, useState } from "react";
import type { CheckInState, Guest, GuestFilter } from "../types/guest";
import { applyGuestFilter, sortGuestsForDesk } from "../lib/guest";
import { cn } from "../lib/cn";
import { GuestList } from "./GuestList";

type FullGuestListProps = {
  guests: Guest[];
  onStateChange: (guestId: string, nextState: CheckInState) => void;
  onMarkPaid: (guestId: string) => void;
};

const filterOptions: Array<{ value: GuestFilter; label: string }> = [
  { value: "all", label: "All users" },
  { value: "vip", label: "VIP only" },
  { value: "normal", label: "Normal only" },
  { value: "entered", label: "Entered" },
  { value: "not_entered", label: "Not entered" },
  { value: "left", label: "Left" },
  { value: "not_fully_paid", label: "Not fully paid" },
];

export function FullGuestList({ guests, onMarkPaid, onStateChange }: FullGuestListProps) {
  const [filter, setFilter] = useState<GuestFilter>("all");
  const filteredGuests = useMemo(
    () => sortGuestsForDesk(applyGuestFilter(guests, filter)),
    [filter, guests],
  );

  return (
    <section aria-labelledby="guest-list-heading" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">
            Registry
          </p>
          <h2 className="text-2xl font-bold text-stone-950" id="guest-list-heading">
            Full guest list
          </h2>
        </div>
        <p className="text-sm font-semibold text-stone-600">
          {filteredGuests.length} of {guests.length}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterOptions.map((option) => {
          const isSelected = filter === option.value;
          const isIncompletePayment = option.value === "not_fully_paid";

          return (
            <button
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition",
                isSelected && isIncompletePayment
                  ? "border-rose-600 bg-rose-600 text-white"
                  : false,
                isSelected && !isIncompletePayment
                  ? "border-teal-700 bg-teal-700 text-white"
                  : false,
                !isSelected && isIncompletePayment
                  ? "border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300 hover:bg-rose-100"
                  : false,
                !isSelected && !isIncompletePayment
                  ? "border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50"
                  : false,
              )}
              key={option.value}
              onClick={() => setFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <GuestList
        emptyDescription="No guests are currently in this filter."
        emptyTitle="Nothing to show"
        guests={filteredGuests}
        onMarkPaid={onMarkPaid}
        onStateChange={onStateChange}
      />
    </section>
  );
}
