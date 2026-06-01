import { describe, expect, it } from "vitest";
import type { Guest } from "../types/guest";
import { searchGuests } from "./search";

const guests: Guest[] = [
  makeGuest("1", "Ava Stone", "+1 (555) 100-2000"),
  makeGuest("2", "Ava Mercer", "555-100-2001"),
  makeGuest("3", "Mina Stone", "555 100 2002"),
  makeGuest("4", "Jon Adams", "5551002003"),
];

describe("searchGuests", () => {
  it("matches all guests with the entered first name", () => {
    expect(searchGuests(guests, " ava ").map((guest) => guest.id)).toEqual(["1", "2"]);
  });

  it("matches partial names case-insensitively with normalized spaces", () => {
    expect(searchGuests(guests, "MINA   st").map((guest) => guest.id)).toEqual(["3"]);
  });

  it("uses exact normalized phone matching for phone-like searches", () => {
    expect(searchGuests(guests, " +1 555-100-2000 ").map((guest) => guest.id)).toEqual([
      "1",
    ]);
    expect(searchGuests(guests, "5551002000")).toEqual([]);
  });
});

function makeGuest(id: string, name: string, phoneNumber: string): Guest {
  return {
    id,
    name,
    phoneNumber,
    normalizedPhoneNumber: phoneNumber.replace(/[\s()+-]/g, ""),
    status: "normal",
    payment: "full",
    checkInState: "not_entered",
    importedAt: "2026-06-01T00:00:00.000Z",
  };
}
