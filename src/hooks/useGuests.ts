import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CheckInState, Guest, GuestImportCandidate } from "../types/guest";
import {
  createGuestId,
  getGuestStats,
  markGuestPaymentFull,
  mergeLocalGuestProgressIntoHostGuests,
  refreshGuestRoster,
  updateGuestCheckInState,
} from "../lib/guest";
import {
  type GoogleSheetSyncStatus,
  isUnauthorizedHostError,
  loadGoogleSheetSyncStatus,
  loadGuestsFromHost,
  saveGoogleSheetSyncUrl,
  saveGuestsToHost,
  saveUploadedRosterToHost,
} from "../lib/hostStorage";
import { loadGuestsFromStorage, saveGuestsToStorage } from "../lib/storage";
import type { AuthSession } from "./useAuth";

export type ImportGuestsResult = {
  importedCount: number;
  savedToHost: boolean;
};

export type GoogleSheetSyncResult = {
  importedCount: number;
  savedToHost: boolean;
};

export type StorageMode = "checking" | "host" | "local";

const hostRefreshIntervalMs = 5 * 60 * 1000;

type UseGuestsOptions = {
  onHostSessionExpired?: () => void;
};

export function useGuests(authSession: AuthSession | null, options: UseGuestsOptions = {}) {
  const { onHostSessionExpired } = options;
  const [guests, setGuests] = useState<Guest[]>(() => loadGuestsFromStorage());
  const [storageMode, setStorageMode] = useState<StorageMode>("checking");
  const [googleSheetSync, setGoogleSheetSync] = useState<GoogleSheetSyncStatus | null>(null);
  const guestsRef = useRef(guests);
  const authTokenRef = useRef(authSession?.token ?? "");
  const hostStorageAvailableRef = useRef(false);
  const hasUnsavedHostChangesRef = useRef(false);
  const pendingRosterFileRef = useRef<File | null>(null);
  const stats = useMemo(() => getGuestStats(guests), [guests]);

  useEffect(() => {
    authTokenRef.current = authSession?.token ?? "";
  }, [authSession?.token]);

  const disableHostStorage = useCallback(() => {
    hostStorageAvailableRef.current = false;
    setStorageMode("local");
  }, []);

  const handleHostStorageError = useCallback(
    (error: unknown) => {
      if (isUnauthorizedHostError(error)) {
        hostStorageAvailableRef.current = false;
        setStorageMode("local");
        onHostSessionExpired?.();
        return;
      }

      disableHostStorage();
    },
    [disableHostStorage, onHostSessionExpired],
  );

  const storeGuestsLocally = useCallback((nextGuests: Guest[]) => {
    guestsRef.current = nextGuests;
    setGuests(nextGuests);
    saveGuestsToStorage(nextGuests);
  }, []);

  const persistGuestsToHost = useCallback(
    async (nextGuests: Guest[]): Promise<boolean> => {
      const authToken = authTokenRef.current;

      if (!hostStorageAvailableRef.current || !authToken) {
        return false;
      }

      try {
        await saveGuestsToHost(nextGuests, authToken);
        if (guestsRef.current === nextGuests) {
          hasUnsavedHostChangesRef.current = false;
        }
        return true;
      } catch (error) {
        handleHostStorageError(error);
        return false;
      }
    },
    [handleHostStorageError],
  );

  const applyGuestChanges = useCallback(
    (nextGuests: Guest[]) => {
      hasUnsavedHostChangesRef.current = true;
      storeGuestsLocally(nextGuests);
      void persistGuestsToHost(nextGuests);
    },
    [persistGuestsToHost, storeGuestsLocally],
  );

  const pushLocalProgressToHost = useCallback(
    async (hostGuests: Guest[], authToken: string): Promise<Guest[] | null> => {
      const localGuests = guestsRef.current;
      const mergedGuests = mergeLocalGuestProgressIntoHostGuests(hostGuests, localGuests);
      const hasLocalProgress = mergedGuests.some((guest, index) => guest !== hostGuests[index]);

      if (!hasLocalProgress) {
        return hostGuests;
      }

      hasUnsavedHostChangesRef.current = true;

      try {
        await saveGuestsToHost(mergedGuests, authToken);

        if (guestsRef.current !== localGuests && guestsRef.current !== mergedGuests) {
          return null;
        }

        hasUnsavedHostChangesRef.current = false;
        pendingRosterFileRef.current = null;

        return mergedGuests;
      } catch (error) {
        handleHostStorageError(error);
        return null;
      }
    },
    [handleHostStorageError],
  );

  useEffect(() => {
    let isMounted = true;
    const authToken = authSession?.token;

    if (!authToken) {
      hostStorageAvailableRef.current = false;
      setStorageMode("local");
      return () => {
        isMounted = false;
      };
    }

    setStorageMode("checking");

    loadGuestsFromHost(authToken)
      .then(async (hostGuests) => {
        if (!isMounted) {
          return;
        }

        hostStorageAvailableRef.current = true;
        setStorageMode("host");

        void loadGoogleSheetSyncStatus(authToken)
          .then(setGoogleSheetSync)
          .catch(handleHostStorageError);

        if (hasUnsavedHostChangesRef.current) {
          const pendingRosterFile = pendingRosterFileRef.current;
          const nextGuests = guestsRef.current;

          if (!pendingRosterFile) {
            const syncedGuests = await pushLocalProgressToHost(hostGuests, authToken);

            if (isMounted && syncedGuests) {
              storeGuestsLocally(syncedGuests);
            }

            return;
          }

          void Promise.all([
            saveGuestsToHost(nextGuests, authToken),
            saveUploadedRosterToHost(pendingRosterFile, authToken),
          ])
            .then(() => {
              if (guestsRef.current === nextGuests) {
                hasUnsavedHostChangesRef.current = false;
                pendingRosterFileRef.current = null;
              }
            })
            .catch(handleHostStorageError);
          return;
        }

        const syncedGuests = await pushLocalProgressToHost(hostGuests, authToken);

        if (isMounted && syncedGuests) {
          storeGuestsLocally(syncedGuests);
        }
      })
      .catch((error) => {
        if (isMounted) {
          handleHostStorageError(error);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    authSession?.token,
    handleHostStorageError,
    persistGuestsToHost,
    pushLocalProgressToHost,
    storeGuestsLocally,
  ]);

  useEffect(() => {
    if (storageMode !== "host") {
      return undefined;
    }

    const refreshFromHost = () => {
      if (hasUnsavedHostChangesRef.current) {
        return;
      }

      const authToken = authTokenRef.current;

      if (!authToken) {
        disableHostStorage();
        return;
      }

      void Promise.all([loadGuestsFromHost(authToken), loadGoogleSheetSyncStatus(authToken)])
        .then(([hostGuests, sync]) => {
          if (!hasUnsavedHostChangesRef.current) {
            storeGuestsLocally(hostGuests);
            setGoogleSheetSync(sync);
          }
        })
        .catch(handleHostStorageError);
    };
    const interval = window.setInterval(refreshFromHost, hostRefreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [disableHostStorage, handleHostStorageError, storageMode, storeGuestsLocally]);

  const importGuests = useCallback(
    async (candidates: GuestImportCandidate[], rosterFile: File): Promise<ImportGuestsResult> => {
      const candidatesWithIds = candidates.map<GuestImportCandidate>((candidate) => ({
        ...candidate,
        id: candidate.id ?? createGuestId(candidate.normalizedPhoneNumber),
      }));
      const nextGuests = refreshGuestRoster(guestsRef.current, candidatesWithIds);
      let savedToHost = false;

      hasUnsavedHostChangesRef.current = true;
      pendingRosterFileRef.current = rosterFile;
      storeGuestsLocally(nextGuests);

      const authToken = authTokenRef.current;

      if (hostStorageAvailableRef.current && authToken) {
        try {
          await Promise.all([
            saveGuestsToHost(nextGuests, authToken),
            saveUploadedRosterToHost(rosterFile, authToken),
          ]);
          savedToHost = true;
          if (guestsRef.current === nextGuests) {
            hasUnsavedHostChangesRef.current = false;
            pendingRosterFileRef.current = null;
          }
        } catch (error) {
          handleHostStorageError(error);
        }
      }

      return {
        importedCount: nextGuests.length,
        savedToHost,
      };
    },
    [handleHostStorageError, storeGuestsLocally],
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

        hasUnsavedHostChangesRef.current = false;
        pendingRosterFileRef.current = null;
        storeGuestsLocally(result.guests);
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
    [handleHostStorageError, storeGuestsLocally],
  );

  const setCheckInState = useCallback((guestId: string, nextState: CheckInState) => {
    applyGuestChanges(
      guestsRef.current.map((guest) =>
        guest.id === guestId ? updateGuestCheckInState(guest, nextState) : guest,
      ),
    );
  }, [applyGuestChanges]);

  const markGuestPaid = useCallback((guestId: string) => {
    applyGuestChanges(
      guestsRef.current.map((guest) =>
        guest.id === guestId ? markGuestPaymentFull(guest) : guest,
      ),
    );
  }, [applyGuestChanges]);

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
