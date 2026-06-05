import { describe, expect, it } from "vitest";
import type { Guest, GuestImportCandidate } from "../types/guest";
import {
  getGuestStats,
  markGuestPaymentFull,
  mergeLocalGuestProgressIntoHostGuests,
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

  it("preserves check-in state when a unique guest name changes in the roster", () => {
    const enteredAt = "2026-06-01T10:00:00.000Z";
    const currentGuests: Guest[] = [
      {
        ...makeGuest("existing-row", "not fully paid"),
        checkInState: "entered",
        enteredAt,
      },
    ];
    const candidates: GuestImportCandidate[] = [
      {
        ...makeCandidate("imported-row", "not fully paid"),
        name: "Ava S.",
      },
    ];

    const refreshedGuests = refreshGuestRoster(currentGuests, candidates);

    expect(refreshedGuests[0]).toMatchObject({
      id: "existing-row",
      name: "Ava S.",
      checkInState: "entered",
      enteredAt,
    });
  });

  it("does not match by phone when duplicate phone numbers make the guest ambiguous", () => {
    const currentGuests: Guest[] = [
      {
        ...makeGuest("first-existing-row", "not fully paid"),
        checkInState: "entered",
        enteredAt: "2026-06-01T10:00:00.000Z",
      },
      {
        ...makeGuest("second-existing-row", "not fully paid"),
        name: "Avery Stone",
      },
    ];
    const candidates: GuestImportCandidate[] = [
      {
        ...makeCandidate("imported-row", "not fully paid"),
        name: "Ava S.",
      },
    ];

    const refreshedGuests = refreshGuestRoster(currentGuests, candidates);

    expect(refreshedGuests[0]).toMatchObject({
      id: "imported-row",
      checkInState: "not_entered",
      name: "Ava S.",
    });
  });
});

describe("mergeLocalGuestProgressIntoHostGuests", () => {
  it("pushes local entered progress into the host roster without replacing host details", () => {
    const hostGuests = [makeGuest("host-row", "not fully paid")];
    const localGuests: Guest[] = [
      {
        ...makeGuest("local-row", "full"),
        amountPaid: 100,
        checkInState: "entered",
        enteredAt: "2026-06-01T10:00:00.000Z",
      },
    ];

    const mergedGuests = mergeLocalGuestProgressIntoHostGuests(hostGuests, localGuests);

    expect(mergedGuests[0]).toMatchObject({
      id: "host-row",
      checkInState: "entered",
      enteredAt: "2026-06-01T10:00:00.000Z",
      payment: "full",
    });
    expect(mergedGuests[0]?.amountPaid).toBeUndefined();
  });

  it("does not downgrade host progress from stale local storage", () => {
    const hostGuests: Guest[] = [
      {
        ...makeGuest("host-row", "full"),
        checkInState: "left",
        enteredAt: "2026-06-01T10:00:00.000Z",
        leftAt: "2026-06-01T11:00:00.000Z",
      },
    ];
    const localGuests: Guest[] = [
      {
        ...makeGuest("local-row", "not fully paid"),
        checkInState: "entered",
        enteredAt: "2026-06-01T10:30:00.000Z",
      },
    ];

    const mergedGuests = mergeLocalGuestProgressIntoHostGuests(hostGuests, localGuests);

    expect(mergedGuests[0]).toMatchObject({
      checkInState: "left",
      leftAt: "2026-06-01T11:00:00.000Z",
      payment: "full",
    });
  });

  it("skips local phone-only recovery when duplicate host rows are ambiguous", () => {
    const hostGuests: Guest[] = [
      makeGuest("first-host-row", "not fully paid"),
      {
        ...makeGuest("second-host-row", "not fully paid"),
        name: "Avery Stone",
      },
    ];
    const localGuests: Guest[] = [
      {
        ...makeGuest("local-row", "not fully paid"),
        name: "Ava S.",
        checkInState: "entered",
        enteredAt: "2026-06-01T10:00:00.000Z",
      },
    ];

    const mergedGuests = mergeLocalGuestProgressIntoHostGuests(hostGuests, localGuests);

    expect(mergedGuests[0]).toBe(hostGuests[0]);
    expect(mergedGuests[1]).toBe(hostGuests[1]);
    expect(mergedGuests.every((guest) => guest.checkInState === "not_entered")).toBe(true);
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
