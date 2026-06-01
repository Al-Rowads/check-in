import { describe, expect, it } from "vitest";
import type { Guest, GuestImportCandidate } from "../types/guest";
import {
  getGuestStats,
  markGuestPaymentFull,
  refreshGuestRoster,
  updateGuestCheckInState,
} from "./guest";

describe("guest payment helpers", () => {
  it("marks an incomplete payment as full and updates incomplete payment stats", () => {
    const unpaidGuest = makeGuest("1", "not fully paid");
    const paidGuest = markGuestPaymentFull(unpaidGuest);

    expect(paidGuest.payment).toBe("full");
    expect(getGuestStats([unpaidGuest]).incompletePayment).toBe(1);
    expect(getGuestStats([paidGuest]).incompletePayment).toBe(0);
  });
});

describe("guest check-in helpers", () => {
  it("can mark a not-entered guest as left directly", () => {
    const guest = makeGuest("1", "full");
    const leftGuest = updateGuestCheckInState(guest, "left");

    expect(leftGuest.checkInState).toBe("left");
    expect(leftGuest.enteredAt).toBeDefined();
    expect(leftGuest.leftAt).toBeDefined();
  });
});

describe("refreshGuestRoster", () => {
  it("replaces the visible roster and updates matching guests with imported values", () => {
    const enteredAt = "2026-06-01T10:00:00.000Z";
    const currentGuests: Guest[] = [
      {
        ...makeGuest("old-row", "not fully paid"),
        checkInState: "entered",
        enteredAt,
      },
      {
        ...makeGuest("duplicate-row", "not fully paid"),
        amountPaid: 500,
      },
    ];
    const candidates: GuestImportCandidate[] = [
      {
        ...makeCandidate("imported-row", "not fully paid"),
        amountPaid: 500,
      },
    ];

    const refreshedGuests = refreshGuestRoster(currentGuests, candidates);

    expect(refreshedGuests).toHaveLength(1);
    expect(refreshedGuests[0]).toMatchObject({
      id: "old-row",
      amountPaid: 500,
      checkInState: "entered",
      enteredAt,
    });
  });

  it("keeps duplicate rows that are present in the imported file", () => {
    const candidates: GuestImportCandidate[] = [
      makeCandidate("first-imported-row", "full"),
      makeCandidate("second-imported-row", "not fully paid"),
    ];

    const refreshedGuests = refreshGuestRoster([], candidates);

    expect(refreshedGuests.map((guest) => guest.id)).toEqual([
      "first-imported-row",
      "second-imported-row",
    ]);
  });

  it("preserves a payment that was marked full in the app", () => {
    const currentGuests = [makeGuest("existing-row", "full")];
    const candidates = [makeCandidate("imported-row", "not fully paid")];

    const refreshedGuests = refreshGuestRoster(currentGuests, candidates);

    expect(refreshedGuests[0]?.payment).toBe("full");
  });
});

function makeGuest(id: string, payment: Guest["payment"]): Guest {
  return {
    id,
    name: "Ava Stone",
    phoneNumber: "555-100-2000",
    normalizedPhoneNumber: "5551002000",
    status: "VIP",
    payment,
    checkInState: "not_entered",
    importedAt: "2026-06-01T00:00:00.000Z",
  };
}

function makeCandidate(id: string, payment: Guest["payment"]): GuestImportCandidate {
  const { id: _id, ...guest } = makeGuest(id, payment);

  return {
    ...guest,
    id,
  };
}
