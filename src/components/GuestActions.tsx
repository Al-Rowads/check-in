import type { CheckInState, Guest } from "../types/guest";
import { Button } from "./Button";

type GuestActionsProps = {
  guest: Guest;
  isMarkingEntered?: boolean;
  onStateChange: (guestId: string, nextState: CheckInState) => void;
  onMarkPaid: (guestId: string) => void;
};

export function GuestActions({
  guest,
  isMarkingEntered = false,
  onMarkPaid,
  onStateChange,
}: GuestActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        aria-busy={isMarkingEntered}
        className="min-w-[7.75rem]"
        disabled={guest.checkInState === "entered" || isMarkingEntered}
        onClick={() => onStateChange(guest.id, "entered")}
        size="sm"
      >
        {isMarkingEntered ? (
          <span
            aria-hidden="true"
            className="mr-2 size-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
          />
        ) : null}
        Mark entered
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
