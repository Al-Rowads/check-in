import { useCallback, useEffect, useState } from "react";
import { ADMIN_CREDENTIALS, AUTH_STORAGE_KEY } from "../config/auth";

export type LoginResult =
  | { ok: true }
  | { ok: false; message: string };

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(AUTH_STORAGE_KEY) === "authenticated";
  });

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem(AUTH_STORAGE_KEY, "authenticated");
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [isAuthenticated]);

  const login = useCallback((username: string, password: string): LoginResult => {
    if (
      username.trim() === ADMIN_CREDENTIALS.username &&
      password === ADMIN_CREDENTIALS.password
    ) {
      setIsAuthenticated(true);

      return { ok: true };
    }

    return {
      ok: false,
      message: "Invalid username or password.",
    };
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  return {
    isAuthenticated,
    login,
    logout,
  };
}
