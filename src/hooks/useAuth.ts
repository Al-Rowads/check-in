import { useCallback, useState } from "react";
import type { UserRole } from "../config/auth";
import { HostRequestError, loginToHost, logoutFromHost } from "../lib/hostStorage";

const authStorageKey = "event-check-in:auth-session";

export type AuthSession = {
  username: string;
  role: UserRole;
  token: string;
};

export type LoginResult =
  | { ok: true }
  | { ok: false; message: string };

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession());
  const isAuthenticated = session !== null;

  const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    try {
      const hostSession = await loginToHost(username.trim(), password);

      saveAuthSession(hostSession);
      setSession(hostSession);

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getLoginErrorMessage(error),
      };
    }
  }, []);

  const logout = useCallback(() => {
    const authToken = session?.token;

    clearAuthSession();
    setSession(null);

    if (authToken) {
      void logoutFromHost(authToken).catch(() => undefined);
    }
  }, [session?.token]);

  return {
    isAuthenticated,
    login,
    logout,
    session,
  };
}

function loadAuthSession(): AuthSession | null {
  const storedSession = readStoredAuthSession();

  if (!storedSession) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(storedSession);

    if (isAuthSession(parsed)) {
      return parsed;
    }
  } catch {
    // Invalid saved auth is cleared below.
  }

  clearAuthSession();
  return null;
}

function readStoredAuthSession(): string | null {
  try {
    return localStorage.getItem(authStorageKey);
  } catch {
    return null;
  }
}

function saveAuthSession(session: AuthSession): void {
  try {
    localStorage.setItem(
      authStorageKey,
      JSON.stringify({
        role: session.role,
        token: session.token,
        username: session.username,
      }),
    );
  } catch {
    // Keep the in-memory session when browser storage is unavailable.
  }
}

function clearAuthSession(): void {
  try {
    localStorage.removeItem(authStorageKey);
  } catch {
    // Nothing to clear when browser storage is unavailable.
  }
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<AuthSession>;

  return (
    typeof session.username === "string" &&
    (session.role === "admin" || session.role === "user") &&
    typeof session.token === "string"
  );
}

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof HostRequestError) {
    return error.message;
  }

  return "The backend API is unavailable. Start the host server and try again.";
}
