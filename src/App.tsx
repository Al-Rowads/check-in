import { useCallback, useEffect, useRef, useState } from "react";
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
      const saved = await setCheckInState(guestId, nextState);
      searchInputRef.current?.focus();

      if (!saved) {
        addToast({
          title: "Could not save",
          description: "The backend API did not confirm the guest update.",
          tone: "error",
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
    const saved = await markGuestPaid(guestId);
    searchInputRef.current?.focus();

    if (!guest) {
      return;
    }

    if (!saved) {
      addToast({
        title: "Could not save",
        description: "The backend API did not confirm the payment update.",
        tone: "error",
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
      <div className="min-h-screen">
        <header className="border-b border-stone-200 bg-white/88 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase text-teal-700">
                {isAdmin ? "Admin panel" : "Check-in panel"}
              </p>
              <h1 className="text-3xl font-bold text-stone-950">Event check-in desk</h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
                {getRoleLabel(session?.role)}
              </div>
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
                {guests.length} registered
              </div>
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
                {getStorageModeLabel(storageMode)}
              </div>
              <Button onClick={handleLogout} variant="secondary">
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
                ? "grid gap-8 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] xl:items-start"
                : "grid gap-8"
            }
          >
            {isAdmin ? (
              <ImportPanel
                onImport={importGuests}
                onSyncGoogleSheet={syncGoogleSheetUrl}
                onToast={addToast}
              />
            ) : null}
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

function getStorageModeLabel(storageMode: ReturnType<typeof useGuests>["storageMode"]): string {
  switch (storageMode) {
    case "checking":
      return "Checking backend";
    case "host":
      return "Backend synced";
    case "error":
      return "Backend unavailable";
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
