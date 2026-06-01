import { useCallback, useEffect, useState } from "react";
import { AUTH_STORAGE_KEY, STATIC_USERS, type UserRole } from "../config/auth";
import { loginToHost } from "../lib/hostStorage";

export type AuthSession = {
  username: string;
  role: UserRole;
  token?: string;
};

export type LoginResult =
  | { ok: true }
  | { ok: false; message: string };

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession());
  const isAuthenticated = session !== null;

  useEffect(() => {
    if (session) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [session]);

  const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    const staticSession = authenticateStaticUser(username, password);

    try {
      const hostSession = await loginToHost(username.trim(), password);
      setSession(hostSession);

      return { ok: true };
    } catch {
      if (staticSession) {
        setSession(staticSession);

        return { ok: true };
      }
    }

    return {
      ok: false,
      message: "Invalid username or password.",
    };
  }, []);

  const logout = useCallback(() => {
    setSession(null);
  }, []);

  return {
    isAuthenticated,
    login,
    logout,
    session,
  };
}

function authenticateStaticUser(username: string, password: string): AuthSession | null {
  const trimmedUsername = username.trim();
  const user = STATIC_USERS.find(
    (currentUser) =>
      currentUser.username === trimmedUsername && currentUser.password === password,
  );

  if (!user) {
    return null;
  }

  return {
    role: user.role,
    username: user.username,
  };
}

function loadAuthSession(): AuthSession | null {
  const storedSession = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedSession) {
    return null;
  }

  if (storedSession === "authenticated") {
    return {
      role: "admin",
      username: "admin",
    };
  }

  try {
    const parsed: unknown = JSON.parse(storedSession);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const session = parsed as Partial<AuthSession>;

    if (
      typeof session.username === "string" &&
      (session.role === "admin" || session.role === "user") &&
      (session.token === undefined || typeof session.token === "string")
    ) {
      const authSession: AuthSession = {
        role: session.role,
        username: session.username,
      };

      if (session.token) {
        authSession.token = session.token;
      }

      return authSession;
    }
  } catch {
    return null;
  }

  return null;
}
