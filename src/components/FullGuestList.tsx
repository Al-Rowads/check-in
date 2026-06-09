import { useMemo, useState } from "react";
import { ListFilter } from "lucide-react";
import type { CheckInState, Guest, GuestFilter } from "../types/guest";
import { applyGuestFilter, sortGuestsForDesk } from "../lib/guest";
import { GuestList } from "./GuestList";
import { SectionHeader, SegmentedControl, StatusPill } from "./ui";

type FullGuestListProps = {
  guests: Guest[];
  isCheckInActionPending: (guestId: string, nextState: CheckInState) => boolean;
  onStateChange: (guestId: string, nextState: CheckInState) => void;
  onMarkPaid: (guestId: string) => void;
};

const filterOptions: Array<{ value: GuestFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "vip", label: "VIP" },
  { value: "normal", label: "Normal" },
  { value: "entered", label: "Entered" },
  { value: "not_entered", label: "Waiting" },
  { value: "left", label: "Left" },
  { value: "not_fully_paid", label: "Payment due" },
];

export function FullGuestList({
  guests,
  isCheckInActionPending,
  onMarkPaid,
  onStateChange,
}: FullGuestListProps) {
  const [filter, setFilter] = useState<GuestFilter>("all");
  const filteredGuests = useMemo(
    () => sortGuestsForDesk(applyGuestFilter(guests, filter)),
    [filter, guests],
  );
  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        filterOptions.map((option) => [
          option.value,
          applyGuestFilter(guests, option.value).length,
        ]),
      ) as Record<GuestFilter, number>,
    [guests],
  );

  return (
    <section aria-labelledby="guest-list-heading" className="grid gap-4">
      <SectionHeader
        action={
          <StatusPill tone="neutral">
            {filteredGuests.length} of {guests.length}
          </StatusPill>
        }
        description="Scan, filter, and correct attendee states after the first lookup pass."
        eyebrow="Registry"
        icon={<ListFilter aria-hidden="true" className="size-4" />}
        title="Full guest list"
        titleId="guest-list-heading"
      />

      <SegmentedControl
        ariaLabel="Guest list filters"
        onChange={setFilter}
        options={filterOptions.map((option) => ({
          ...option,
          meta: filterCounts[option.value],
          tone:
            option.value === "not_fully_paid"
              ? "danger"
              : option.value === "vip"
                ? "blue"
                : "default",
        }))}
        value={filter}
      />

      <GuestList
        emptyDescription="No guests are currently in this filter."
        emptyTitle="Nothing to show"
        guests={filteredGuests}
        isCheckInActionPending={isCheckInActionPending}
        onMarkPaid={onMarkPaid}
        onStateChange={onStateChange}
      />
    </section>
  );
}
