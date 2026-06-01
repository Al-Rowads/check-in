import type {
  CheckInState,
  DashboardStats,
  Guest,
  GuestFilter,
  GuestImportCandidate,
} from "../types/guest";

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

export function refreshGuestRoster(
  currentGuests: Guest[],
  candidates: GuestImportCandidate[],
): Guest[] {
  const existingGuestsByKey = currentGuests.reduce<Map<string, Guest[]>>((guestsByKey, guest) => {
    const key = getRosterIdentityKey(guest);
    const existingGuests = guestsByKey.get(key);

    if (existingGuests) {
      existingGuests.push(guest);
    } else {
      guestsByKey.set(key, [guest]);
    }

    return guestsByKey;
  }, new Map());

  return candidates.map<Guest>((candidate) => {
    const key = getRosterIdentityKey(candidate);
    const matchedGuest = existingGuestsByKey.get(key)?.shift();
    const guest: Guest = {
      ...candidate,
      id: matchedGuest?.id ?? candidate.id ?? createGuestId(candidate.normalizedPhoneNumber),
    };

    if (!matchedGuest) {
      return guest;
    }

    const refreshedGuest: Guest = {
      ...guest,
      checkInState: matchedGuest.checkInState,
      payment: matchedGuest.payment === "full" ? "full" : guest.payment,
    };

    if (matchedGuest.enteredAt && matchedGuest.checkInState !== "not_entered") {
      refreshedGuest.enteredAt = matchedGuest.enteredAt;
    }

    if (matchedGuest.leftAt && matchedGuest.checkInState === "left") {
      refreshedGuest.leftAt = matchedGuest.leftAt;
    }

    return refreshedGuest;
  });
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

function getRosterIdentityKey(
  guest: Pick<Guest, "name" | "normalizedPhoneNumber">,
): string {
  return JSON.stringify([guest.normalizedPhoneNumber, normalizeGuestName(guest.name)]);
}

function normalizeGuestName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
