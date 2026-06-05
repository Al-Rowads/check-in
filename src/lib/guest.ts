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
  const existingGuestsByKey = groupGuestsByIdentityKey(currentGuests);
  const uniqueExistingGuestsByPhone = getUniqueGuestsByPhone(currentGuests);
  const candidatePhoneCounts = countGuestsByPhone(candidates);
  const matchedGuestIds = new Set<string>();

  return candidates.map<Guest>((candidate) => {
    const matchedGuest = takeMatchingGuest(
      candidate,
      existingGuestsByKey,
      uniqueExistingGuestsByPhone,
      candidatePhoneCounts,
      matchedGuestIds,
    );
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

export function mergeLocalGuestProgressIntoHostGuests(
  hostGuests: Guest[],
  localGuests: Guest[],
): Guest[] {
  const localGuestsByKey = groupGuestsByIdentityKey(localGuests);
  const uniqueLocalGuestsByPhone = getUniqueGuestsByPhone(localGuests);
  const hostPhoneCounts = countGuestsByPhone(hostGuests);
  const matchedLocalGuestIds = new Set<string>();

  return hostGuests.map((hostGuest) => {
    const localGuest = takeMatchingGuest(
      hostGuest,
      localGuestsByKey,
      uniqueLocalGuestsByPhone,
      hostPhoneCounts,
      matchedLocalGuestIds,
    );

    return localGuest ? mergeGuestProgress(hostGuest, localGuest) : hostGuest;
  });
}

function mergeGuestProgress(hostGuest: Guest, localGuest: Guest): Guest {
  let nextGuest = hostGuest;

  if (localGuest.payment === "full" && hostGuest.payment !== "full") {
    nextGuest = {
      ...nextGuest,
      payment: "full",
    };
  }

  if (checkInStateRank(localGuest.checkInState) > checkInStateRank(hostGuest.checkInState)) {
    if (localGuest.checkInState === "entered") {
      const { leftAt: _leftAt, ...rest } = nextGuest;

      nextGuest = {
        ...rest,
        checkInState: "entered",
        enteredAt: localGuest.enteredAt ?? hostGuest.enteredAt ?? new Date().toISOString(),
      };
    }

    if (localGuest.checkInState === "left") {
      nextGuest = {
        ...nextGuest,
        checkInState: "left",
        enteredAt:
          localGuest.enteredAt ??
          hostGuest.enteredAt ??
          localGuest.leftAt ??
          new Date().toISOString(),
        leftAt: localGuest.leftAt ?? hostGuest.leftAt ?? new Date().toISOString(),
      };
    }
  }

  if (
    localGuest.checkInState === "entered" &&
    nextGuest.checkInState === "entered" &&
    localGuest.enteredAt &&
    !nextGuest.enteredAt
  ) {
    nextGuest = {
      ...nextGuest,
      enteredAt: localGuest.enteredAt,
    };
  }

  if (
    localGuest.checkInState === "left" &&
    nextGuest.checkInState === "left" &&
    (localGuest.enteredAt || localGuest.leftAt) &&
    (!nextGuest.enteredAt || !nextGuest.leftAt)
  ) {
    const mergedGuest = { ...nextGuest };

    if (!mergedGuest.enteredAt && localGuest.enteredAt) {
      mergedGuest.enteredAt = localGuest.enteredAt;
    }

    if (!mergedGuest.leftAt && localGuest.leftAt) {
      mergedGuest.leftAt = localGuest.leftAt;
    }

    nextGuest = mergedGuest;
  }

  return nextGuest;
}

function groupGuestsByIdentityKey(guests: Guest[]): Map<string, Guest[]> {
  return guests.reduce<Map<string, Guest[]>>((guestsByKey, guest) => {
    const key = getRosterIdentityKey(guest);
    const existingGuests = guestsByKey.get(key);

    if (existingGuests) {
      existingGuests.push(guest);
    } else {
      guestsByKey.set(key, [guest]);
    }

    return guestsByKey;
  }, new Map());
}

function getUniqueGuestsByPhone(guests: Guest[]): Map<string, Guest> {
  const guestsByPhone = guests.reduce<Map<string, Guest[]>>((phoneGroups, guest) => {
    const key = getRosterPhoneKey(guest);
    const existingGuests = phoneGroups.get(key);

    if (existingGuests) {
      existingGuests.push(guest);
    } else {
      phoneGroups.set(key, [guest]);
    }

    return phoneGroups;
  }, new Map());

  return Array.from(guestsByPhone.entries()).reduce<Map<string, Guest>>(
    (uniqueGuests, [phoneKey, phoneGuests]) => {
      if (phoneGuests.length === 1 && phoneGuests[0]) {
        uniqueGuests.set(phoneKey, phoneGuests[0]);
      }

      return uniqueGuests;
    },
    new Map(),
  );
}

function countGuestsByPhone(
  guests: Array<Pick<Guest, "normalizedPhoneNumber">>,
): Map<string, number> {
  return guests.reduce<Map<string, number>>((phoneCounts, guest) => {
    const key = getRosterPhoneKey(guest);

    phoneCounts.set(key, (phoneCounts.get(key) ?? 0) + 1);

    return phoneCounts;
  }, new Map());
}

function takeMatchingGuest(
  candidate: Pick<Guest, "name" | "normalizedPhoneNumber">,
  existingGuestsByKey: Map<string, Guest[]>,
  uniqueExistingGuestsByPhone: Map<string, Guest>,
  candidatePhoneCounts: Map<string, number>,
  matchedGuestIds: Set<string>,
): Guest | undefined {
  const key = getRosterIdentityKey(candidate);
  const exactMatches = existingGuestsByKey.get(key);

  while (exactMatches?.length) {
    const matchedGuest = exactMatches.shift();

    if (matchedGuest && !matchedGuestIds.has(matchedGuest.id)) {
      matchedGuestIds.add(matchedGuest.id);
      return matchedGuest;
    }
  }

  const phoneKey = getRosterPhoneKey(candidate);

  if (candidatePhoneCounts.get(phoneKey) !== 1) {
    return undefined;
  }

  const phoneMatchedGuest = uniqueExistingGuestsByPhone.get(phoneKey);

  if (!phoneMatchedGuest || matchedGuestIds.has(phoneMatchedGuest.id)) {
    return undefined;
  }

  matchedGuestIds.add(phoneMatchedGuest.id);
  return phoneMatchedGuest;
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

function checkInStateRank(state: CheckInState): number {
  switch (state) {
    case "not_entered":
      return 0;
    case "entered":
      return 1;
    case "left":
      return 2;
  }
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

function getRosterPhoneKey(guest: Pick<Guest, "normalizedPhoneNumber">): string {
  return guest.normalizedPhoneNumber;
}

function normalizeGuestName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
