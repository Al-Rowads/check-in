import type { Guest } from "../types/guest";

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
