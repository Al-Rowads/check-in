import { describe, expect, it } from "vitest";
import type { Guest } from "../types/guest";
import { getGuestStats, markGuestPaymentFull } from "./guest";

describe("guest payment helpers", () => {
  it("marks an incomplete payment as full and updates incomplete payment stats", () => {
    const unpaidGuest = makeGuest("1", "not fully paid");
    const paidGuest = markGuestPaymentFull(unpaidGuest);

    expect(paidGuest.payment).toBe("full");
    expect(getGuestStats([unpaidGuest]).incompletePayment).toBe(1);
    expect(getGuestStats([paidGuest]).incompletePayment).toBe(0);
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
