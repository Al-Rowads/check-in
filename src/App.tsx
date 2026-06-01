import { useEffect, useRef } from "react";
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
  const { isAuthenticated, login, logout } = useAuth();
  const { guests, stats, importGuests, markGuestPaid, setCheckInState } = useGuests();
  const { toasts, addToast, dismissToast } = useToasts();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isAuthenticated]);

  function handleStateChange(guestId: string, nextState: CheckInState) {
    const guest = guests.find((currentGuest) => currentGuest.id === guestId);
    setCheckInState(guestId, nextState);
    searchInputRef.current?.focus();

    if (!guest) {
      return;
    }

    addToast({
      title: getStateToastTitle(nextState),
      description: guest.name,
      tone: nextState === "left" ? "info" : nextState === "entered" ? "success" : "warning",
    });
  }

  function handleMarkPaid(guestId: string) {
    const guest = guests.find((currentGuest) => currentGuest.id === guestId);
    markGuestPaid(guestId);
    searchInputRef.current?.focus();

    if (!guest) {
      return;
    }

    addToast({
      title: "Marked as paid",
      description: guest.name,
      tone: "success",
    });
  }

  function handleLogout() {
    logout();
    addToast({
      title: "Logged out",
      description: "The admin panel is locked.",
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
              <p className="text-sm font-bold uppercase text-teal-700">Admin panel</p>
              <h1 className="text-3xl font-bold text-stone-950">Event check-in desk</h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-700">
                {guests.length} registered
              </div>
              <Button onClick={handleLogout} variant="secondary">
                Log out
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:px-8">
          <DashboardStats stats={stats} />

          <div className="grid gap-8 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] xl:items-start">
            <ImportPanel onImport={importGuests} onToast={addToast} />
            <GuestSearch
              guests={guests}
              inputRef={searchInputRef}
              onMarkPaid={handleMarkPaid}
              onStateChange={handleStateChange}
            />
          </div>

          <FullGuestList
            guests={guests}
            onMarkPaid={handleMarkPaid}
            onStateChange={handleStateChange}
          />
        </main>
      </div>

      <ToastViewport onDismiss={dismissToast} toasts={toasts} />
    </>
  );
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
