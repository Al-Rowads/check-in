import type { CheckInState, Guest } from "../types/guest";
import { Button } from "./Button";

type GuestActionsProps = {
  guest: Guest;
  onStateChange: (guestId: string, nextState: CheckInState) => void;
  onMarkPaid: (guestId: string) => void;
};

export function GuestActions({ guest, onMarkPaid, onStateChange }: GuestActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={guest.checkInState === "entered"}
        onClick={() => onStateChange(guest.id, "entered")}
        size="sm"
      >
        Mark entered
      </Button>
      <Button
        disabled={guest.checkInState === "left"}
        onClick={() => onStateChange(guest.id, "left")}
        size="sm"
        variant="secondary"
      >
        Mark left
      </Button>
      <Button
        disabled={guest.checkInState === "not_entered"}
        onClick={() => onStateChange(guest.id, "not_entered")}
        size="sm"
        variant="ghost"
      >
        Reset
      </Button>
      {guest.payment === "not fully paid" ? (
        <Button onClick={() => onMarkPaid(guest.id)} size="sm" variant="secondary">
          Mark paid
        </Button>
      ) : null}
    </div>
  );
}
