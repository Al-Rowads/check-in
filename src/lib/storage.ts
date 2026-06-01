import type { Guest } from "../types/guest";

export const GUEST_STORAGE_KEY = "event-check-in:guests";

export function loadGuestsFromStorage(): Guest[] {
  const stored = localStorage.getItem(GUEST_STORAGE_KEY);

  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);

    return parseStoredGuests(parsed);
  } catch {
    return [];
  }
}

export function saveGuestsToStorage(guests: Guest[]): void {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guests));
}

export function parseStoredGuests(value: unknown): Guest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isStoredGuest);
}

export function isStoredGuest(value: unknown): value is Guest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const guest = value as Partial<Guest>;

  return (
    typeof guest.id === "string" &&
    typeof guest.name === "string" &&
    typeof guest.phoneNumber === "string" &&
    typeof guest.normalizedPhoneNumber === "string" &&
    (guest.status === "VIP" || guest.status === "normal") &&
    (guest.payment === "full" || guest.payment === "not fully paid") &&
    (guest.checkInState === "not_entered" ||
      guest.checkInState === "entered" ||
      guest.checkInState === "left") &&
    typeof guest.importedAt === "string"
  );
}
