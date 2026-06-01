import { useCallback, useEffect, useMemo, useState } from "react";
import type { CheckInState, Guest, GuestImportCandidate } from "../types/guest";
import {
  createGuestId,
  getGuestStats,
  markGuestPaymentFull,
  refreshGuestRoster,
  updateGuestCheckInState,
} from "../lib/guest";
import { loadGuestsFromStorage, saveGuestsToStorage } from "../lib/storage";

export type ImportGuestsResult = {
  importedCount: number;
};

export function useGuests() {
  const [guests, setGuests] = useState<Guest[]>(() => loadGuestsFromStorage());
  const stats = useMemo(() => getGuestStats(guests), [guests]);

  useEffect(() => {
    saveGuestsToStorage(guests);
  }, [guests]);

  const importGuests = useCallback(
    (candidates: GuestImportCandidate[]): ImportGuestsResult => {
      const candidatesWithIds = candidates.map<GuestImportCandidate>((candidate) => ({
        ...candidate,
        id: candidate.id ?? createGuestId(candidate.normalizedPhoneNumber),
      }));

      setGuests((currentGuests) => refreshGuestRoster(currentGuests, candidatesWithIds));

      return {
        importedCount: candidatesWithIds.length,
      };
    },
    [],
  );

  const setCheckInState = useCallback((guestId: string, nextState: CheckInState) => {
    setGuests((currentGuests) =>
      currentGuests.map((guest) =>
        guest.id === guestId ? updateGuestCheckInState(guest, nextState) : guest,
      ),
    );
  }, []);

  const markGuestPaid = useCallback((guestId: string) => {
    setGuests((currentGuests) =>
      currentGuests.map((guest) =>
        guest.id === guestId ? markGuestPaymentFull(guest) : guest,
      ),
    );
  }, []);

  return {
    guests,
    stats,
    importGuests,
    setCheckInState,
    markGuestPaid,
  };
}
