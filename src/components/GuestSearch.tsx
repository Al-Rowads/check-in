import { KeyboardEvent, RefObject, useMemo, useState } from "react";
import { Download, Search, TicketCheck, UsersRound } from "lucide-react";
import type { CheckInState, Guest } from "../types/guest";
import { sortGuestsForDesk } from "../lib/guest";
import { searchGuests } from "../lib/search";
import { Button } from "./Button";
import { Field, TextInput } from "./Field";
import { GuestList } from "./GuestList";
import { Panel, SectionHeader, StatusPill } from "./ui";

type GuestSearchProps = {
  guests: Guest[];
  inputRef: RefObject<HTMLInputElement>;
  isCheckInActionPending: (guestId: string, nextState: CheckInState) => boolean;
  isExportingEnteredCsv?: boolean;
  onExportEnteredCsv?: () => void;
  onStateChange: (guestId: string, nextState: CheckInState) => void;
  onMarkPaid: (guestId: string) => void;
};

export function GuestSearch({
  guests,
  inputRef,
  isCheckInActionPending,
  isExportingEnteredCsv = false,
  onExportEnteredCsv,
  onMarkPaid,
  onStateChange,
}: GuestSearchProps) {
  const [query, setQuery] = useState("");
  const matches = useMemo(
    () => sortGuestsForDesk(searchGuests(guests, query)),
    [guests, query],
  );
  const limitedMatches = query.trim() ? matches.slice(0, 24) : [];
  const hasQuery = Boolean(query.trim());

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
      <SectionHeader
        action={
          onExportEnteredCsv ? (
            <Button
              icon={<Download aria-hidden="true" className="size-4" />}
              isLoading={isExportingEnteredCsv}
              onClick={onExportEnteredCsv}
              size="sm"
              variant="secondary"
            >
              {isExportingEnteredCsv ? "Exporting" : "Export entered CSV"}
            </Button>
          ) : null
        }
        description="Search by guest name or exact phone, then commit entry from the result row."
        eyebrow="Check-in"
        icon={<TicketCheck aria-hidden="true" className="size-4" />}
        title="Guest search"
        titleId="guest-search-heading"
      />

      <Panel className="grid gap-4" tone="accent">
        <Field
          hint={limitedMatches.length === 1 ? "Press Enter to mark entered" : undefined}
          label="Search by name or phone number"
        >
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-alrowad-orange"
            />
            <TextInput
              autoComplete="off"
              className="min-h-14 border-alrowad-orange/28 bg-black/48 pl-12 text-lg"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Start typing a guest name or exact phone"
              ref={inputRef}
              value={query}
            />
          </div>
        </Field>

        <div className="flex flex-wrap gap-2">
          <StatusPill icon={<UsersRound aria-hidden="true" className="size-4" />} tone="orange">
            {hasQuery
              ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}`
              : `${guests.length} guests ready`}
          </StatusPill>
          {hasQuery && matches.length > limitedMatches.length ? (
            <StatusPill tone="neutral">Showing first {limitedMatches.length}</StatusPill>
          ) : null}
        </div>
      </Panel>

      <GuestList
        emptyDescription={
          hasQuery
            ? "No guests match that search."
            : guests.length > 0
              ? "Start typing to search the active roster."
              : "Import a guest list, then search from this desk view."
        }
        emptyTitle={hasQuery ? "No matches" : "Ready for guest lookup"}
        guests={limitedMatches}
        isCheckInActionPending={isCheckInActionPending}
        layout="compact"
        onMarkPaid={onMarkPaid}
        onStateChange={onStateChange}
      />
    </section>
  );
}
