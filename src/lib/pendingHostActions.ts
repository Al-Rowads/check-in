import type { CheckInState, Guest } from "../types/guest";
import { markGuestPaymentFull, updateGuestCheckInState } from "./guest";

export type PendingCheckInState = Extract<CheckInState, "entered" | "not_entered">;

export type PendingHostAction =
  | {
      id: string;
      guestId: string;
      nextState: PendingCheckInState;
      queuedAt: string;
      type: "check-in";
    }
  | {
      id: string;
      guestId: string;
      queuedAt: string;
      type: "payment";
    };

export function createPendingCheckInAction(
  guestId: string,
  nextState: PendingCheckInState,
): PendingHostAction {
  return {
    id: createPendingActionId(guestId),
    guestId,
    nextState,
    queuedAt: new Date().toISOString(),
    type: "check-in",
  };
}

export function createPendingPaymentAction(guestId: string): PendingHostAction {
  return {
    id: createPendingActionId(guestId),
    guestId,
    queuedAt: new Date().toISOString(),
    type: "payment",
  };
}

export function parseStoredPendingHostActions(value: unknown): PendingHostAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPendingHostAction);
}

export function applyPendingHostActionsToGuests(
  guests: Guest[],
  actions: PendingHostAction[],
): Guest[] {
  return actions.reduce(applyPendingHostActionToGuests, guests);
}

export function applyPendingHostActionToGuests(
  guests: Guest[],
  action: PendingHostAction,
): Guest[] {
  let didApplyAction = false;
  const nextGuests = guests.map((guest) => {
    if (guest.id !== action.guestId) {
      return guest;
    }

    didApplyAction = true;

    if (action.type === "payment") {
      return markGuestPaymentFull(guest);
    }

    return updateGuestCheckInState(guest, action.nextState);
  });

  return didApplyAction ? nextGuests : guests;
}

export function removePendingHostAction(
  actions: PendingHostAction[],
  actionId: string,
): PendingHostAction[] {
  return actions.filter((action) => action.id !== actionId);
}

function isPendingHostAction(value: unknown): value is PendingHostAction {
  if (!value || typeof value !== "object") {
    return false;
  }

  const action = value as Partial<PendingHostAction>;

  if (
    typeof action.id !== "string" ||
    typeof action.guestId !== "string" ||
    typeof action.queuedAt !== "string"
  ) {
    return false;
  }

  if (action.type === "payment") {
    return true;
  }

  return (
    action.type === "check-in" &&
    (action.nextState === "entered" || action.nextState === "not_entered")
  );
}

function createPendingActionId(guestId: string): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${guestId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
