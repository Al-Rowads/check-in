import { KeyboardEvent, RefObject, useMemo, useState } from "react";
import type { CheckInState, Guest } from "../types/guest";
import { sortGuestsForDesk } from "../lib/guest";
import { searchGuests } from "../lib/search";
import { Field, TextInput } from "./Field";
import { GuestList } from "./GuestList";

type GuestSearchProps = {
  guests: Guest[];
  inputRef: RefObject<HTMLInputElement>;
  onStateChange: (guestId: string, nextState: CheckInState) => void;
  onMarkPaid: (guestId: string) => void;
};

export function GuestSearch({
  guests,
  inputRef,
  onMarkPaid,
  onStateChange,
}: GuestSearchProps) {
  const [query, setQuery] = useState("");
  const matches = useMemo(
    () => sortGuestsForDesk(searchGuests(guests, query)),
    [guests, query],
  );
  const limitedMatches = query.trim() ? matches.slice(0, 24) : [];

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || limitedMatches.length !== 1) {
      return;
    }

    const guest = limitedMatches[0];

    if (!guest || guest.checkInState === "entered") {
      return;
    }

    event.preventDefault();
    onStateChange(guest.id, "entered");
  }

  return (
    <section aria-labelledby="guest-search-heading" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">
            Check-in
          </p>
          <h2 className="text-2xl font-bold text-stone-950" id="guest-search-heading">
            Guest search
          </h2>
        </div>
        {query.trim() ? (
          <p className="text-sm font-semibold text-stone-600">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
          </p>
        ) : null}
      </div>

      <Field label="Search by name or phone number">
        <TextInput
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Start typing a guest name or exact phone"
          ref={inputRef}
          value={query}
        />
      </Field>

      <GuestList
        emptyDescription={
          query.trim()
            ? "No guests match that search."
            : "Import a guest list, then search from this desk view."
        }
        emptyTitle={query.trim() ? "No matches" : "Ready for guest lookup"}
        guests={limitedMatches}
        onMarkPaid={onMarkPaid}
        onStateChange={onStateChange}
      />
    </section>
  );
}
