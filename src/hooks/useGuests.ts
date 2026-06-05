import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CheckInState, Guest, GuestImportCandidate } from "../types/guest";
import {
  createGuestId,
  getGuestStats,
  refreshGuestRoster,
} from "../lib/guest";
import {
  HostRequestError,
  type GoogleSheetSyncStatus,
  isUnauthorizedHostError,
  loadEnteredGuestsCsvFromHost,
  loadGoogleSheetSyncStatus,
  loadGuestsFromHost,
  saveGuestCheckInStateToHost,
  saveGuestPaymentToHost,
  saveGoogleSheetSyncUrl,
  saveGuestsToHost,
  saveUploadedRosterToHost,
} from "../lib/hostStorage";
import {
  applyPendingHostActionToGuests,
  applyPendingHostActionsToGuests,
  createPendingCheckInAction,
  createPendingPaymentAction,
  parseStoredPendingHostActions,
  removePendingHostAction,
  type PendingCheckInState,
  type PendingHostAction,
} from "../lib/pendingHostActions";
import type { AuthSession } from "./useAuth";

export type ImportGuestsResult = {
  importedCount: number;
  savedToHost: boolean;
};

export type GoogleSheetSyncResult = {
  importedCount: number;
  savedToHost: boolean;
};

export type StorageMode = "checking" | "host" | "error";

export type GuestActionResult = {
  applied: boolean;
  queued: boolean;
  savedToHost: boolean;
};

const hostRefreshIntervalMs = 5 * 1000;
const pendingHostActionsStorageKey = "event-check-in:pending-host-actions";

type UseGuestsOptions = {
  onHostSessionExpired?: () => void;
};

export function useGuests(authSession: AuthSession | null, options: UseGuestsOptions = {}) {
  const { onHostSessionExpired } = options;
  const [guests, setGuests] = useState<Guest[]>([]);
  const [storageMode, setStorageMode] = useState<StorageMode>("checking");
  const [googleSheetSync, setGoogleSheetSync] = useState<GoogleSheetSyncStatus | null>(null);
  const [pendingHostActions, setPendingHostActions] = useState<PendingHostAction[]>(() =>
    loadPendingHostActions(),
  );
  const guestsRef = useRef<Guest[]>([]);
  const authTokenRef = useRef(authSession?.token ?? "");
  const hostStorageAvailableRef = useRef(false);
  const pendingHostSaveCountRef = useRef(0);
  const pendingHostActionsRef = useRef<PendingHostAction[]>(pendingHostActions);
  const isFlushingPendingHostActionsRef = useRef(false);
  const stats = useMemo(() => getGuestStats(guests), [guests]);

  useEffect(() => {
    authTokenRef.current = authSession?.token ?? "";
  }, [authSession?.token]);

  const setHostGuests = useCallback((nextGuests: Guest[]) => {
    const guestsWithPendingActions = applyPendingHostActionsToGuests(
      nextGuests,
      pendingHostActionsRef.current,
    );

    guestsRef.current = guestsWithPendingActions;
    setGuests(guestsWithPendingActions);
  }, []);

  const setPendingHostActionsAndPersist = useCallback(
    (
      getNextActions:
        | PendingHostAction[]
        | ((currentActions: PendingHostAction[]) => PendingHostAction[]),
    ) => {
      const currentActions = pendingHostActionsRef.current;
      const nextActions =
        typeof getNextActions === "function"
          ? getNextActions(currentActions)
          : getNextActions;

      pendingHostActionsRef.current = nextActions;
      savePendingHostActions(nextActions);
      setPendingHostActions(nextActions);
    },
    [],
  );

  const handleHostStorageError = useCallback(
    (error: unknown) => {
      hostStorageAvailableRef.current = false;
      setStorageMode("error");

      if (isUnauthorizedHostError(error)) {
        setHostGuests([]);
        setGoogleSheetSync(null);
        onHostSessionExpired?.();
      }
    },
    [onHostSessionExpired, setHostGuests],
  );

  const loadGoogleSheetSyncStatusSafely = useCallback(
    async (authToken: string) => {
      try {
        setGoogleSheetSync(await loadGoogleSheetSyncStatus(authToken));
      } catch (error) {
        if (isUnauthorizedHostError(error)) {
          handleHostStorageError(error);
        }
      }
    },
    [handleHostStorageError],
  );

  const removePendingHostActionById = useCallback(
    (actionId: string) => {
      setPendingHostActionsAndPersist((currentActions) =>
        removePendingHostAction(currentActions, actionId),
      );
    },
    [setPendingHostActionsAndPersist],
  );

  const applyQueuedHostAction = useCallback(
    (action: PendingHostAction): boolean => {
      const nextGuests = applyPendingHostActionToGuests(guestsRef.current, action);

      if (nextGuests === guestsRef.current) {
        return false;
      }

      guestsRef.current = nextGuests;
      setGuests(nextGuests);
      setPendingHostActionsAndPersist((currentActions) => [...currentActions, action]);

      return true;
    },
    [setPendingHostActionsAndPersist],
  );

  const savePendingHostActionToHost = useCallback(
    (action: PendingHostAction, authToken: string): Promise<Guest[]> => {
      if (action.type === "payment") {
        return saveGuestPaymentToHost(action.guestId, authToken);
      }

      return saveGuestCheckInStateToHost(action.guestId, action.nextState, authToken);
    },
    [],
  );

  const flushPendingHostActions = useCallback(
    async (authToken: string): Promise<boolean> => {
      if (isFlushingPendingHostActionsRef.current) {
        return pendingHostActionsRef.current.length === 0;
      }

      isFlushingPendingHostActionsRef.current = true;
      pendingHostSaveCountRef.current += 1;

      try {
        while (pendingHostActionsRef.current.length > 0) {
          if (authTokenRef.current !== authToken) {
            return false;
          }

          const action = pendingHostActionsRef.current[0];

          if (!action) {
            break;
          }

          try {
            const savedGuests = await savePendingHostActionToHost(action, authToken);

            removePendingHostActionById(action.id);
            hostStorageAvailableRef.current = true;
            setStorageMode("host");
            setHostGuests(savedGuests);
          } catch (error) {
            if (isUnauthorizedHostError(error)) {
              handleHostStorageError(error);
              return false;
            }

            if (isRejectedPendingHostAction(error)) {
              removePendingHostActionById(action.id);
              try {
                setHostGuests(await loadGuestsFromHost(authToken));
              } catch (reloadError) {
                handleHostStorageError(reloadError);
                return false;
              }
              continue;
            }

            handleHostStorageError(error);
            return false;
          }
        }

        hostStorageAvailableRef.current = true;
        setStorageMode("host");

        return true;
      } finally {
        pendingHostSaveCountRef.current = Math.max(0, pendingHostSaveCountRef.current - 1);
        isFlushingPendingHostActionsRef.current = false;
      }
    },
    [
      handleHostStorageError,
      removePendingHostActionById,
      savePendingHostActionToHost,
      setHostGuests,
    ],
  );

  const refreshHostState = useCallback(async () => {
    if (pendingHostSaveCountRef.current > 0) {
      return;
    }

    const authToken = authTokenRef.current;

    if (!authToken) {
      hostStorageAvailableRef.current = false;
      setStorageMode("error");
      setHostGuests([]);
      setGoogleSheetSync(null);
      return;
    }

    try {
      const hostGuests = await loadGuestsFromHost(authToken);

      if (authTokenRef.current !== authToken) {
        return;
      }

      hostStorageAvailableRef.current = true;
      setStorageMode("host");
      setHostGuests(hostGuests);
      await flushPendingHostActions(authToken);

      if (authTokenRef.current !== authToken) {
        return;
      }

      await loadGoogleSheetSyncStatusSafely(authToken);
    } catch (error) {
      handleHostStorageError(error);
    }
  }, [
    flushPendingHostActions,
    handleHostStorageError,
    loadGoogleSheetSyncStatusSafely,
    setHostGuests,
  ]);

  useEffect(() => {
    const authToken = authSession?.token;

    hostStorageAvailableRef.current = false;
    pendingHostSaveCountRef.current = 0;
    setHostGuests([]);
    setGoogleSheetSync(null);

    if (!authToken) {
      setStorageMode("checking");
      return;
    }

    setStorageMode("checking");
    void refreshHostState();
  }, [authSession?.token, refreshHostState, setHostGuests]);

  useEffect(() => {
    if (storageMode === "checking" || !authSession?.token) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void refreshHostState();
    }, hostRefreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [authSession?.token, refreshHostState, storageMode]);

  const importGuests = useCallback(
    async (candidates: GuestImportCandidate[], rosterFile: File): Promise<ImportGuestsResult> => {
      const authToken = authTokenRef.current;

      if (!hostStorageAvailableRef.current || !authToken) {
        return {
          importedCount: guestsRef.current.length,
          savedToHost: false,
        };
      }

      const candidatesWithIds = candidates.map<GuestImportCandidate>((candidate) => ({
        ...candidate,
        id: candidate.id ?? createGuestId(candidate.normalizedPhoneNumber),
      }));
      const nextGuests = refreshGuestRoster(guestsRef.current, candidatesWithIds);

      pendingHostSaveCountRef.current += 1;

      try {
        await saveUploadedRosterToHost(rosterFile, authToken);
        const savedGuests = await saveGuestsToHost(nextGuests, authToken);

        hostStorageAvailableRef.current = true;
        setStorageMode("host");
        setHostGuests(savedGuests);

        return {
          importedCount: savedGuests.length,
          savedToHost: true,
        };
      } catch (error) {
        handleHostStorageError(error);

        return {
          importedCount: guestsRef.current.length,
          savedToHost: false,
        };
      } finally {
        pendingHostSaveCountRef.current = Math.max(0, pendingHostSaveCountRef.current - 1);
      }
    },
    [handleHostStorageError, setHostGuests],
  );

  const syncGoogleSheetUrl = useCallback(
    async (url: string): Promise<GoogleSheetSyncResult> => {
      if (!hostStorageAvailableRef.current) {
        return {
          importedCount: guestsRef.current.length,
          savedToHost: false,
        };
      }

      const authToken = authTokenRef.current;

      if (!authToken) {
        return {
          importedCount: guestsRef.current.length,
          savedToHost: false,
        };
      }

      try {
        const result = await saveGoogleSheetSyncUrl(url, authToken);

        hostStorageAvailableRef.current = true;
        setStorageMode("host");
        setHostGuests(result.guests);
        setGoogleSheetSync(result.sync);

        return {
          importedCount: result.guests.length,
          savedToHost: true,
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes("Google Sheet")) {
          throw error;
        }

        handleHostStorageError(error);

        return {
          importedCount: guestsRef.current.length,
          savedToHost: false,
        };
      }
    },
    [handleHostStorageError, setHostGuests],
  );

  const exportEnteredGuestsCsv = useCallback(async (): Promise<Blob | null> => {
    const authToken = authTokenRef.current;

    if (!hostStorageAvailableRef.current || !authToken) {
      return null;
    }

    try {
      return await loadEnteredGuestsCsvFromHost(authToken);
    } catch (error) {
      handleHostStorageError(error);
      return null;
    }
  }, [handleHostStorageError]);

  const setCheckInState = useCallback(
    async (guestId: string, nextState: CheckInState): Promise<GuestActionResult> => {
      const authToken = authTokenRef.current;

      if (!isPendingCheckInState(nextState)) {
        return {
          applied: false,
          queued: false,
          savedToHost: false,
        };
      }

      const action = createPendingCheckInAction(guestId, nextState);
      const applied = applyQueuedHostAction(action);

      if (!applied) {
        return {
          applied: false,
          queued: false,
          savedToHost: false,
        };
      }

      if (!hostStorageAvailableRef.current || !authToken) {
        return {
          applied: true,
          queued: true,
          savedToHost: false,
        };
      }

      pendingHostSaveCountRef.current += 1;

      try {
        const savedGuests = await savePendingHostActionToHost(action, authToken);

        removePendingHostActionById(action.id);
        hostStorageAvailableRef.current = true;
        setStorageMode("host");
        setHostGuests(savedGuests);

        return {
          applied: true,
          queued: pendingHostActionsRef.current.some(
            (pendingAction) => pendingAction.id === action.id,
          ),
          savedToHost: true,
        };
      } catch (error) {
        handleHostStorageError(error);

        return {
          applied: true,
          queued: true,
          savedToHost: false,
        };
      } finally {
        pendingHostSaveCountRef.current = Math.max(0, pendingHostSaveCountRef.current - 1);
      }
    },
    [
      applyQueuedHostAction,
      handleHostStorageError,
      removePendingHostActionById,
      savePendingHostActionToHost,
      setHostGuests,
    ],
  );

  const markGuestPaid = useCallback(
    async (guestId: string): Promise<GuestActionResult> => {
      const authToken = authTokenRef.current;
      const action = createPendingPaymentAction(guestId);
      const applied = applyQueuedHostAction(action);

      if (!applied) {
        return {
          applied: false,
          queued: false,
          savedToHost: false,
        };
      }

      if (!hostStorageAvailableRef.current || !authToken) {
        return {
          applied: true,
          queued: true,
          savedToHost: false,
        };
      }

      pendingHostSaveCountRef.current += 1;

      try {
        const savedGuests = await savePendingHostActionToHost(action, authToken);

        removePendingHostActionById(action.id);
        hostStorageAvailableRef.current = true;
        setStorageMode("host");
        setHostGuests(savedGuests);

        return {
          applied: true,
          queued: pendingHostActionsRef.current.some(
            (pendingAction) => pendingAction.id === action.id,
          ),
          savedToHost: true,
        };
      } catch (error) {
        handleHostStorageError(error);

        return {
          applied: true,
          queued: true,
          savedToHost: false,
        };
      } finally {
        pendingHostSaveCountRef.current = Math.max(0, pendingHostSaveCountRef.current - 1);
      }
    },
    [
      applyQueuedHostAction,
      handleHostStorageError,
      removePendingHostActionById,
      savePendingHostActionToHost,
      setHostGuests,
    ],
  );

  return {
    guests,
    stats,
    exportEnteredGuestsCsv,
    importGuests,
    googleSheetSync,
    pendingHostActionCount: pendingHostActions.length,
    syncGoogleSheetUrl,
    storageMode,
    setCheckInState,
    markGuestPaid,
  };
}

function loadPendingHostActions(): PendingHostAction[] {
  if (typeof localStorage === "undefined") {
    return [];
  }

  try {
    const storedActions = localStorage.getItem(pendingHostActionsStorageKey);

    if (!storedActions) {
      return [];
    }

    return parseStoredPendingHostActions(JSON.parse(storedActions));
  } catch {
    return [];
  }
}

function savePendingHostActions(actions: PendingHostAction[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    if (actions.length === 0) {
      localStorage.removeItem(pendingHostActionsStorageKey);
      return;
    }

    localStorage.setItem(pendingHostActionsStorageKey, JSON.stringify(actions));
  } catch {
    // Keep the in-memory queue when browser storage is unavailable.
  }
}

function isPendingCheckInState(state: CheckInState): state is PendingCheckInState {
  return state === "entered" || state === "not_entered";
}

function isRejectedPendingHostAction(error: unknown): boolean {
  return (
    error instanceof HostRequestError &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}
