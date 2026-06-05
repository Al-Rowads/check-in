import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CheckInState, Guest, GuestImportCandidate } from "../types/guest";
import {
  createGuestId,
  getGuestStats,
  refreshGuestRoster,
} from "../lib/guest";
import {
  type GoogleSheetSyncStatus,
  isUnauthorizedHostError,
  loadGoogleSheetSyncStatus,
  loadGuestsFromHost,
  saveGuestCheckInStateToHost,
  saveGuestPaymentToHost,
  saveGoogleSheetSyncUrl,
  saveGuestsToHost,
  saveUploadedRosterToHost,
} from "../lib/hostStorage";
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

const hostRefreshIntervalMs = 5 * 1000;

type UseGuestsOptions = {
  onHostSessionExpired?: () => void;
};

export function useGuests(authSession: AuthSession | null, options: UseGuestsOptions = {}) {
  const { onHostSessionExpired } = options;
  const [guests, setGuests] = useState<Guest[]>([]);
  const [storageMode, setStorageMode] = useState<StorageMode>("checking");
  const [googleSheetSync, setGoogleSheetSync] = useState<GoogleSheetSyncStatus | null>(null);
  const guestsRef = useRef<Guest[]>([]);
  const authTokenRef = useRef(authSession?.token ?? "");
  const hostStorageAvailableRef = useRef(false);
  const pendingHostSaveCountRef = useRef(0);
  const stats = useMemo(() => getGuestStats(guests), [guests]);

  useEffect(() => {
    authTokenRef.current = authSession?.token ?? "";
  }, [authSession?.token]);

  const setHostGuests = useCallback((nextGuests: Guest[]) => {
    guestsRef.current = nextGuests;
    setGuests(nextGuests);
  }, []);

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

  const persistGuestsToHost = useCallback(
    async (nextGuests: Guest[]): Promise<Guest[] | null> => {
      const authToken = authTokenRef.current;

      if (!hostStorageAvailableRef.current || !authToken) {
        return null;
      }

      pendingHostSaveCountRef.current += 1;

      try {
        const savedGuests = await saveGuestsToHost(nextGuests, authToken);

        hostStorageAvailableRef.current = true;
        setStorageMode("host");
        setHostGuests(savedGuests);

        return savedGuests;
      } catch (error) {
        handleHostStorageError(error);
        return null;
      } finally {
        pendingHostSaveCountRef.current = Math.max(0, pendingHostSaveCountRef.current - 1);
      }
    },
    [handleHostStorageError, setHostGuests],
  );

  useEffect(() => {
    let isMounted = true;
    const authToken = authSession?.token;

    hostStorageAvailableRef.current = false;
    pendingHostSaveCountRef.current = 0;
    setHostGuests([]);
    setGoogleSheetSync(null);

    if (!authToken) {
      setStorageMode("checking");
      return () => {
        isMounted = false;
      };
    }

    setStorageMode("checking");

    loadGuestsFromHost(authToken)
      .then((hostGuests) => {
        if (!isMounted) {
          return;
        }

        hostStorageAvailableRef.current = true;
        setStorageMode("host");
        setHostGuests(hostGuests);

        void loadGoogleSheetSyncStatus(authToken)
          .then((sync) => {
            if (isMounted) {
              setGoogleSheetSync(sync);
            }
          })
          .catch((error) => {
            if (isMounted) {
              handleHostStorageError(error);
            }
          });
      })
      .catch((error) => {
        if (isMounted) {
          handleHostStorageError(error);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authSession?.token, handleHostStorageError, setHostGuests]);

  useEffect(() => {
    if (storageMode !== "host") {
      return undefined;
    }

    const refreshFromHost = () => {
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

      void Promise.all([loadGuestsFromHost(authToken), loadGoogleSheetSyncStatus(authToken)])
        .then(([hostGuests, sync]) => {
          if (pendingHostSaveCountRef.current === 0) {
            setHostGuests(hostGuests);
            setGoogleSheetSync(sync);
          }
        })
        .catch(handleHostStorageError);
    };
    const interval = window.setInterval(refreshFromHost, hostRefreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [handleHostStorageError, storageMode, setHostGuests]);

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

  const setCheckInState = useCallback(
    async (guestId: string, nextState: CheckInState): Promise<boolean> => {
      const authToken = authTokenRef.current;

      if (!hostStorageAvailableRef.current || !authToken) {
        return false;
      }

      pendingHostSaveCountRef.current += 1;

      try {
        const savedGuests = await saveGuestCheckInStateToHost(guestId, nextState, authToken);

        hostStorageAvailableRef.current = true;
        setStorageMode("host");
        setHostGuests(savedGuests);

        return true;
      } catch (error) {
        handleHostStorageError(error);
        return false;
      } finally {
        pendingHostSaveCountRef.current = Math.max(0, pendingHostSaveCountRef.current - 1);
      }
    },
    [handleHostStorageError, setHostGuests],
  );

  const markGuestPaid = useCallback(
    async (guestId: string): Promise<boolean> => {
      const authToken = authTokenRef.current;

      if (!hostStorageAvailableRef.current || !authToken) {
        return false;
      }

      pendingHostSaveCountRef.current += 1;

      try {
        const savedGuests = await saveGuestPaymentToHost(guestId, authToken);

        hostStorageAvailableRef.current = true;
        setStorageMode("host");
        setHostGuests(savedGuests);

        return true;
      } catch (error) {
        handleHostStorageError(error);
        return false;
      } finally {
        pendingHostSaveCountRef.current = Math.max(0, pendingHostSaveCountRef.current - 1);
      }
    },
    [handleHostStorageError, setHostGuests],
  );

  return {
    guests,
    stats,
    importGuests,
    googleSheetSync,
    syncGoogleSheetUrl,
    storageMode,
    setCheckInState,
    markGuestPaid,
  };
}
