import { describe, expect, it } from "vitest";
import type { Guest } from "../types/guest";
import {
  applyPendingHostActionsToGuests,
  parseStoredPendingHostActions,
  type PendingHostAction,
} from "./pendingHostActions";

describe("applyPendingHostActionsToGuests", () => {
  it("applies queued check-in and payment actions in order", () => {
    const guests = [makeGuest("guest-1")];
    const actions: PendingHostAction[] = [
      {
        id: "action-1",
        guestId: "guest-1",
        nextState: "entered",
        queuedAt: "2026-06-05T10:00:00.000Z",
        type: "check-in",
      },
      {
        id: "action-2",
        guestId: "guest-1",
        queuedAt: "2026-06-05T10:01:00.000Z",
        type: "payment",
      },
    ];

    const nextGuests = applyPendingHostActionsToGuests(guests, actions);

    expect(nextGuests[0]).toMatchObject({
      checkInState: "entered",
      payment: "full",
    });
    expect(nextGuests[0]?.enteredAt).toEqual(expect.any(String));
    expect(guests[0]).toMatchObject({
      checkInState: "not_entered",
      payment: "not fully paid",
    });
  });

  it("lets a later queued reset clear an earlier queued entered state", () => {
    const guests = [makeGuest("guest-1")];
    const actions: PendingHostAction[] = [
      {
        id: "action-1",
        guestId: "guest-1",
        nextState: "entered",
        queuedAt: "2026-06-05T10:00:00.000Z",
        type: "check-in",
      },
      {
        id: "action-2",
        guestId: "guest-1",
        nextState: "not_entered",
        queuedAt: "2026-06-05T10:01:00.000Z",
        type: "check-in",
      },
    ];

    const nextGuests = applyPendingHostActionsToGuests(guests, actions);

    expect(nextGuests[0]).toMatchObject({
      checkInState: "not_entered",
    });
    expect(nextGuests[0]?.enteredAt).toBeUndefined();
  });
});

describe("parseStoredPendingHostActions", () => {
  it("keeps only queue actions the host can replay", () => {
    expect(
      parseStoredPendingHostActions([
        {
          id: "action-1",
          guestId: "guest-1",
          nextState: "entered",
          queuedAt: "2026-06-05T10:00:00.000Z",
          type: "check-in",
        },
        {
          id: "action-2",
          guestId: "guest-1",
          nextState: "left",
          queuedAt: "2026-06-05T10:01:00.000Z",
          type: "check-in",
        },
        {
          id: "action-3",
          guestId: "guest-1",
          queuedAt: "2026-06-05T10:02:00.000Z",
          type: "payment",
        },
        null,
      ]),
    ).toEqual([
      {
        id: "action-1",
        guestId: "guest-1",
        nextState: "entered",
        queuedAt: "2026-06-05T10:00:00.000Z",
        type: "check-in",
      },
      {
        id: "action-3",
        guestId: "guest-1",
        queuedAt: "2026-06-05T10:02:00.000Z",
        type: "payment",
      },
    ]);
  });
});

function makeGuest(id: string): Guest {
  return {
    id,
    name: "Ava Stone",
    phoneNumber: "555-100-2000",
    normalizedPhoneNumber: "5551002000",
    status: "VIP",
    payment: "not fully paid",
    checkInState: "not_entered",
    importedAt: "2026-06-01T00:00:00.000Z",
  };
}
