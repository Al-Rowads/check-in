import type { CheckInState, Guest } from "../types/guest";
import { Button } from "./Button";
import { CheckCircle2, CreditCard, RotateCcw } from "lucide-react";

type GuestActionsProps = {
  guest: Guest;
  isMarkingEntered?: boolean;
  isResetting?: boolean;
  onStateChange: (guestId: string, nextState: CheckInState) => void;
  onMarkPaid: (guestId: string) => void;
};

export function GuestActions({
  guest,
  isMarkingEntered = false,
  isResetting = false,
  onMarkPaid,
  onStateChange,
}: GuestActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        aria-busy={isMarkingEntered}
        className="min-w-[8.5rem]"
        disabled={guest.checkInState === "entered" || isMarkingEntered}
        icon={<CheckCircle2 aria-hidden="true" className="size-4" />}
        isLoading={isMarkingEntered}
        onClick={() => onStateChange(guest.id, "entered")}
        size="sm"
      >
        {isMarkingEntered ? "Marking" : "Mark entered"}
      </Button>
      <Button
        aria-busy={isResetting}
        disabled={guest.checkInState === "not_entered" || isResetting}
        icon={<RotateCcw aria-hidden="true" className="size-4" />}
        isLoading={isResetting}
        onClick={() => onStateChange(guest.id, "not_entered")}
        size="sm"
        variant="ghost"
      >
        {isResetting ? "Resetting" : "Reset"}
      </Button>
      {guest.payment === "not fully paid" ? (
        <Button
          icon={<CreditCard aria-hidden="true" className="size-4" />}
          onClick={() => onMarkPaid(guest.id)}
          size="sm"
          variant="secondary"
        >
          Mark paid
        </Button>
      ) : null}
    </div>
  );
}
