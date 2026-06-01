import type { Guest } from "../types/guest";
import { looksLikePhoneSearch, normalizePhoneNumber } from "./phone";

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function searchGuests(guests: Guest[], query: string): Guest[] {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return guests;
  }

  if (looksLikePhoneSearch(trimmedQuery)) {
    const normalizedPhone = normalizePhoneNumber(trimmedQuery);

    return guests.filter((guest) => guest.normalizedPhoneNumber === normalizedPhone);
  }

  const normalizedQuery = normalizeName(trimmedQuery);
  const queryParts = normalizedQuery.split(" ");
  const isSingleName = queryParts.length === 1;

  return guests.filter((guest) => {
    const normalizedGuestName = normalizeName(guest.name);
    const firstName = normalizedGuestName.split(" ")[0] ?? "";

    if (isSingleName && firstName === normalizedQuery) {
      return true;
    }

    return normalizedGuestName.includes(normalizedQuery);
  });
}
