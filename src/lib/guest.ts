import type { CheckInState, DashboardStats, Guest, GuestFilter } from "../types/guest";

export function createGuestId(normalizedPhoneNumber: string): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${normalizedPhoneNumber}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getGuestStats(guests: Guest[]): DashboardStats {
  return guests.reduce<DashboardStats>(
    (stats, guest) => {
      stats.totalRegistered += 1;

      if (guest.status === "VIP") {
        stats.totalVip += 1;
      } else {
        stats.totalNormal += 1;
      }

      if (guest.checkInState === "entered") {
        stats.totalEntered += 1;

        if (guest.status === "VIP") {
          stats.enteredVip += 1;
        } else {
          stats.enteredNormal += 1;
        }
      }

      if (guest.checkInState === "left") {
        stats.totalLeft += 1;
      }

      if (guest.checkInState === "not_entered") {
        stats.notEntered += 1;
      }

      if (guest.payment === "not fully paid") {
        stats.incompletePayment += 1;
      }

      return stats;
    },
    {
      totalRegistered: 0,
      totalEntered: 0,
      enteredVip: 0,
      enteredNormal: 0,
      totalLeft: 0,
      notEntered: 0,
      totalVip: 0,
      totalNormal: 0,
      incompletePayment: 0,
    },
  );
}

export function applyGuestFilter(guests: Guest[], filter: GuestFilter): Guest[] {
  switch (filter) {
    case "vip":
      return guests.filter((guest) => guest.status === "VIP");
    case "normal":
      return guests.filter((guest) => guest.status === "normal");
    case "entered":
      return guests.filter((guest) => guest.checkInState === "entered");
    case "not_entered":
      return guests.filter((guest) => guest.checkInState === "not_entered");
    case "left":
      return guests.filter((guest) => guest.checkInState === "left");
    case "not_fully_paid":
      return guests.filter((guest) => guest.payment === "not fully paid");
    case "all":
      return guests;
  }
}

export function updateGuestCheckInState(guest: Guest, nextState: CheckInState): Guest {
  const timestamp = new Date().toISOString();

  if (nextState === "entered") {
    const { leftAt: _leftAt, ...rest } = guest;

    return {
      ...rest,
      checkInState: "entered",
      enteredAt: timestamp,
    };
  }

  if (nextState === "left") {
    return {
      ...guest,
      checkInState: "left",
      enteredAt: guest.enteredAt ?? timestamp,
      leftAt: timestamp,
    };
  }

  const { enteredAt: _enteredAt, leftAt: _leftAt, ...rest } = guest;

  return {
    ...rest,
    checkInState: "not_entered",
  };
}

export function markGuestPaymentFull(guest: Guest): Guest {
  return {
    ...guest,
    payment: "full",
  };
}

export function sortGuestsForDesk(guests: Guest[]): Guest[] {
  return [...guests].sort((first, second) => {
    const stateOrder = stateSortValue(first.checkInState) - stateSortValue(second.checkInState);

    if (stateOrder !== 0) {
      return stateOrder;
    }

    return first.name.localeCompare(second.name);
  });
}

function stateSortValue(state: CheckInState): number {
  switch (state) {
    case "not_entered":
      return 0;
    case "entered":
      return 1;
    case "left":
      return 2;
  }
}
