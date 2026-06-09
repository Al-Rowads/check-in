import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock3,
  DatabaseZap,
  LogOut,
  ShieldCheck,
  UserRoundCog,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { CheckInState } from "./types/guest";
import { useAuth } from "./hooks/useAuth";
import { useGuests } from "./hooks/useGuests";
import { useToasts } from "./hooks/useToasts";
import { Button } from "./components/Button";
import { DashboardStats } from "./components/DashboardStats";
import { FullGuestList } from "./components/FullGuestList";
import { GuestSearch } from "./components/GuestSearch";
import { ImportPanel } from "./components/ImportPanel";
import { LoginScreen } from "./components/LoginScreen";
import { ToastViewport } from "./components/ToastViewport";
import { BrandMark, StatusPill } from "./components/ui";

export function App() {
  const { toasts, addToast, dismissToast } = useToasts();
  const { isAuthenticated, login, logout, session } = useAuth();
  const handleHostSessionExpired = useCallback(() => {
    logout();
    addToast({
      title: "Log in again",
      description: "The saved host session expired.",
      tone: "warning",
    });
  }, [addToast, logout]);
  const {
    guests,
    stats,
    exportEnteredGuestsCsv,
    importGuests,
    markGuestPaid,
    pendingHostActionCount,
    setCheckInState,
    syncGoogleSheetUrl,
    storageMode,
  } = useGuests(session, { onHostSessionExpired: handleHostSessionExpired });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [pendingCheckInActions, setPendingCheckInActions] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [isExportingEnteredCsv, setIsExportingEnteredCsv] = useState(false);
  const isAdmin = session?.role === "admin";

  const isCheckInActionPending = useCallback(
    (guestId: string, nextState: CheckInState) =>
      pendingCheckInActions.has(getCheckInActionKey(guestId, nextState)),
    [pendingCheckInActions],
  );

  useEffect(() => {
    if (isAuthenticated) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isAuthenticated]);

  async function handleStateChange(guestId: string, nextState: CheckInState) {
    const guest = guests.find((currentGuest) => currentGuest.id === guestId);

    if (!guest) {
      return;
    }

    const actionKey = getCheckInActionKey(guestId, nextState);
    setPendingCheckInActions((currentActions) => {
      const nextActions = new Set(currentActions);
      nextActions.add(actionKey);
      return nextActions;
    });

    try {
      const result = await setCheckInState(guestId, nextState);
      searchInputRef.current?.focus();

      if (!result.applied) {
        addToast({
          title: "Could not save",
          description: "The backend API did not confirm the guest update.",
          tone: "error",
        });
        return;
      }

      if (!result.savedToHost) {
        addToast({
          title: "Marked locally",
          description: `${guest.name} will sync when the backend is available.`,
          tone: "warning",
        });
        return;
      }

      addToast({
        title: getStateToastTitle(nextState),
        description: guest.name,
        tone: nextState === "left" ? "info" : nextState === "entered" ? "success" : "warning",
      });
    } finally {
      setPendingCheckInActions((currentActions) => {
        const nextActions = new Set(currentActions);
        nextActions.delete(actionKey);
        return nextActions;
      });
    }
  }

  async function handleMarkPaid(guestId: string) {
    const guest = guests.find((currentGuest) => currentGuest.id === guestId);
    const result = await markGuestPaid(guestId);
    searchInputRef.current?.focus();

    if (!guest) {
      return;
    }

    if (!result.applied) {
      addToast({
        title: "Could not save",
        description: "The backend API did not confirm the payment update.",
        tone: "error",
      });
      return;
    }

    if (!result.savedToHost) {
      addToast({
        title: "Marked paid locally",
        description: `${guest.name} will sync when the backend is available.`,
        tone: "warning",
      });
      return;
    }

    addToast({
      title: "Marked as paid",
      description: guest.name,
      tone: "success",
    });
  }

  async function handleExportEnteredCsv() {
    setIsExportingEnteredCsv(true);

    try {
      const csvBlob = await exportEnteredGuestsCsv();

      if (!csvBlob) {
        addToast({
          title: "Export failed",
          description: "The backend API did not return the entered guests CSV.",
          tone: "error",
        });
        return;
      }

      downloadBlob(csvBlob, `entered-guests-${getLocalDateStamp()}.csv`);
      addToast({
        title: "CSV exported",
        description: "Entered guests were downloaded from the backend.",
        tone: "success",
      });
    } finally {
      setIsExportingEnteredCsv(false);
    }
  }

  function handleLogout() {
    logout();
    addToast({
      title: "Logged out",
      description: "The check-in desk is locked.",
      tone: "info",
    });
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen onLogin={login} />
        <ToastViewport onDismiss={dismissToast} toasts={toasts} />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-alrowad-black text-alrowad-white">
        <header className="top-0 z-40 border-b border-white/10 bg-black/92 backdrop-blur lg:sticky">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <BrandMark compact />
              <div className="hidden h-10 w-px bg-white/10 sm:block" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-alrowad-orange">
                  {isAdmin ? "Admin panel" : "Check-in panel"}
                </p>
                <h1 className="mt-1 text-xl font-semibold text-alrowad-white sm:text-2xl">
                  Event check-in desk
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusPill
                icon={
                  isAdmin ? (
                    <UserRoundCog aria-hidden="true" className="size-4" />
                  ) : (
                    <ShieldCheck aria-hidden="true" className="size-4" />
                  )
                }
                tone={isAdmin ? "orange" : "neutral"}
              >
                {getRoleLabel(session?.role)}
              </StatusPill>
              <StatusPill icon={<UsersRound aria-hidden="true" className="size-4" />}>
                {guests.length} registered
              </StatusPill>
              <StatusPill
                icon={getStorageModeIcon(storageMode, pendingHostActionCount)}
                tone={getStorageModeTone(storageMode, pendingHostActionCount)}
              >
                {getStorageModeLabel(storageMode, pendingHostActionCount)}
              </StatusPill>
              <Button
                icon={<LogOut aria-hidden="true" className="size-4" />}
                onClick={handleLogout}
                variant="secondary"
              >
                Log out
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:px-8">
          <DashboardStats stats={stats} />

          <div
            className={
              isAdmin
                ? "grid gap-8 xl:grid-cols-[minmax(0,1.22fr)_minmax(22rem,0.78fr)] xl:items-start"
                : "grid gap-8"
            }
          >
            <GuestSearch
              guests={guests}
              inputRef={searchInputRef}
              isCheckInActionPending={isCheckInActionPending}
              onMarkPaid={handleMarkPaid}
              onStateChange={handleStateChange}
              {...(isAdmin
                ? {
                    isExportingEnteredCsv,
                    onExportEnteredCsv: handleExportEnteredCsv,
                  }
                : {})}
            />
            {isAdmin ? (
              <ImportPanel
                onImport={importGuests}
                onSyncGoogleSheet={syncGoogleSheetUrl}
                onToast={addToast}
              />
            ) : null}
          </div>

          <FullGuestList
            guests={guests}
            isCheckInActionPending={isCheckInActionPending}
            onMarkPaid={handleMarkPaid}
            onStateChange={handleStateChange}
          />
        </main>
      </div>

      <ToastViewport onDismiss={dismissToast} toasts={toasts} />
    </>
  );
}

function getCheckInActionKey(guestId: string, nextState: CheckInState): string {
  return `${guestId}:${nextState}`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getLocalDateStamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStateToastTitle(state: CheckInState): string {
  switch (state) {
    case "entered":
      return "Marked as entered";
    case "left":
      return "Marked as left";
    case "not_entered":
      return "Status reset";
  }
}

function getStorageModeLabel(
  storageMode: ReturnType<typeof useGuests>["storageMode"],
  pendingHostActionCount: number,
): string {
  if (pendingHostActionCount > 0) {
    return `Sync pending (${pendingHostActionCount})`;
  }

  switch (storageMode) {
    case "checking":
      return "Checking backend";
    case "host":
      return "Backend synced";
    case "error":
      return "Backend unavailable";
  }
}

function getStorageModeIcon(
  storageMode: ReturnType<typeof useGuests>["storageMode"],
  pendingHostActionCount: number,
) {
  if (pendingHostActionCount > 0) {
    return <DatabaseZap aria-hidden="true" className="size-4" />;
  }

  switch (storageMode) {
    case "checking":
      return <Clock3 aria-hidden="true" className="size-4" />;
    case "host":
      return <Wifi aria-hidden="true" className="size-4" />;
    case "error":
      return <WifiOff aria-hidden="true" className="size-4" />;
  }
}

function getStorageModeTone(
  storageMode: ReturnType<typeof useGuests>["storageMode"],
  pendingHostActionCount: number,
): "neutral" | "orange" | "success" | "warning" | "danger" | "blue" {
  if (pendingHostActionCount > 0) {
    return "warning";
  }

  switch (storageMode) {
    case "checking":
      return "neutral";
    case "host":
      return "success";
    case "error":
      return "danger";
  }
}

function getRoleLabel(role: "admin" | "user" | undefined): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "user":
      return "User";
    default:
      return "Signed in";
  }
}
