import { useCallback, useEffect, useMemo, useState } from "react";
import type { CheckInState, Guest, GuestImportCandidate } from "../types/guest";
import {
  createGuestId,
  getGuestStats,
  markGuestPaymentFull,
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
      const importedGuests = candidates.map<Guest>((candidate) => ({
        ...candidate,
        id: candidate.id ?? createGuestId(candidate.normalizedPhoneNumber),
      }));

      setGuests((currentGuests) => [...currentGuests, ...importedGuests]);

      return {
        importedCount: importedGuests.length,
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
