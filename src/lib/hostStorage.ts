import type { CheckInState, Guest } from "../types/guest";
import type { UserRole } from "../config/auth";
import { parseStoredGuests } from "./storage";

const configuredApiBaseUrl = import.meta.env.VITE_CHECKIN_API_URL ?? "";

export class HostRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HostRequestError";
  }
}

export type GoogleSheetSyncStatus = {
  enabled: boolean;
  intervalMs: number;
  lastError: string | null;
  lastGuestCount: number | null;
  lastSyncedAt: string | null;
  sourceUrl: string;
};

export type GoogleSheetSyncResponse = {
  guests: Guest[];
  sync: GoogleSheetSyncStatus;
};

export type HostAuthSession = {
  username: string;
  role: UserRole;
  token: string;
};

export async function loginToHost(
  username: string,
  password: string,
): Promise<HostAuthSession> {
  const response = await fetch(apiUrl("/api/session"), {
    body: JSON.stringify({ password, username }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw await toHostRequestError(response, "Invalid username or password.");
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload) || !isHostAuthSession(payload)) {
    throw new Error("Host login returned an invalid response.");
  }

  return payload;
}

export async function logoutFromHost(authToken: string): Promise<void> {
  const response = await fetch(apiUrl("/api/session"), {
    headers: authHeaders(authToken),
    method: "DELETE",
  });

  if (!response.ok) {
    throw await toHostRequestError(response, "Host logout failed.");
  }
}

export async function loadGuestsFromHost(authToken: string): Promise<Guest[]> {
  const response = await fetch(apiUrl("/api/guests"), {
    cache: "no-store",
    headers: authHeaders(authToken),
  });

  if (!response.ok) {
    throw await toHostRequestError(response, "Host guest storage is unavailable.");
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload)) {
    throw new Error("Host guest storage returned an invalid response.");
  }

  return parseStoredGuests(payload.guests);
}

export async function saveGuestsToHost(guests: Guest[], authToken: string): Promise<Guest[]> {
  const response = await fetch(apiUrl("/api/guests"), {
    body: JSON.stringify({ guests }),
    headers: {
      ...authHeaders(authToken),
      "Content-Type": "application/json",
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw await toHostRequestError(response, "Guest changes could not be saved on the host.");
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload)) {
    throw new Error("Host guest storage returned an invalid save response.");
  }

  return parseStoredGuests(payload.guests);
}

export async function saveGuestCheckInStateToHost(
  guestId: string,
  nextState: CheckInState,
  authToken: string,
): Promise<Guest[]> {
  const response = await fetch(apiUrl(`/api/guests/${encodeURIComponent(guestId)}/check-in`), {
    body: JSON.stringify({ nextState }),
    headers: {
      ...authHeaders(authToken),
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw await toHostRequestError(response, "Guest check-in state could not be saved on the host.");
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload)) {
    throw new Error("Host guest storage returned an invalid check-in response.");
  }

  return parseStoredGuests(payload.guests);
}

export async function saveGuestPaymentToHost(
  guestId: string,
  authToken: string,
): Promise<Guest[]> {
  const response = await fetch(apiUrl(`/api/guests/${encodeURIComponent(guestId)}/payment`), {
    body: JSON.stringify({ payment: "full" }),
    headers: {
      ...authHeaders(authToken),
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw await toHostRequestError(response, "Guest payment could not be saved on the host.");
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload)) {
    throw new Error("Host guest storage returned an invalid payment response.");
  }

  return parseStoredGuests(payload.guests);
}

export async function saveUploadedRosterToHost(
  file: File,
  authToken: string,
): Promise<void> {
  const response = await fetch(apiUrl("/api/roster-upload"), {
    body: JSON.stringify({
      contentBase64: await fileToBase64(file),
      contentType: file.type,
      fileName: file.name,
    }),
    headers: {
      ...authHeaders(authToken),
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw await toHostRequestError(response, "Uploaded roster could not be saved on the host.");
  }
}

export async function loadGoogleSheetSyncStatus(
  authToken: string,
): Promise<GoogleSheetSyncStatus> {
  const response = await fetch(apiUrl("/api/google-sheet-sync"), {
    cache: "no-store",
    headers: authHeaders(authToken),
  });

  if (!response.ok) {
    throw await toHostRequestError(response, "Google Sheets sync status is unavailable.");
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload) || !isGoogleSheetSyncStatus(payload.sync)) {
    throw new Error("Google Sheets sync status returned an invalid response.");
  }

  return payload.sync;
}

export async function saveGoogleSheetSyncUrl(
  url: string,
  authToken: string,
): Promise<GoogleSheetSyncResponse> {
  const response = await fetch(apiUrl("/api/google-sheet-sync"), {
    body: JSON.stringify({ url }),
    headers: {
      ...authHeaders(authToken),
      "Content-Type": "application/json",
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw await toHostRequestError(response, "Google Sheets link could not be synced.");
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload) || !isGoogleSheetSyncStatus(payload.sync)) {
    throw new Error("Google Sheets sync returned an invalid response.");
  }

  return {
    guests: parseStoredGuests(payload.guests),
    sync: payload.sync,
  };
}

function apiUrl(path: string): string {
  return `${resolveApiBaseUrl(configuredApiBaseUrl)}${path}`;
}

export function resolveApiBaseUrl(
  configuredUrl: string,
  currentOrigin = getCurrentOrigin(),
): string {
  const trimmedUrl = configuredUrl.trim().replace(/\/+$/, "");

  if (!trimmedUrl) {
    return "";
  }

  if (!currentOrigin) {
    return trimmedUrl;
  }

  try {
    const resolvedUrl = new URL(trimmedUrl, currentOrigin);
    resolvedUrl.hash = "";
    resolvedUrl.search = "";

    if (resolvedUrl.origin === currentOrigin) {
      return resolvedUrl.pathname.replace(/\/+$/, "");
    }

    return resolvedUrl.toString().replace(/\/+$/, "");
  } catch {
    return trimmedUrl;
  }
}

export function isUnauthorizedHostError(error: unknown): boolean {
  return error instanceof HostRequestError && error.statusCode === 401;
}

function getCurrentOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

function authHeaders(authToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${authToken}`,
  };
}

async function fileToBase64(file: File): Promise<string> {
  return arrayBufferToBase64(await file.arrayBuffer());
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isHostAuthSession(value: unknown): value is HostAuthSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.username === "string" &&
    (value.role === "admin" || value.role === "user") &&
    typeof value.token === "string"
  );
}

function isGoogleSheetSyncStatus(value: unknown): value is GoogleSheetSyncStatus {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.enabled === "boolean" &&
    typeof value.intervalMs === "number" &&
    (typeof value.lastError === "string" || value.lastError === null) &&
    (typeof value.lastGuestCount === "number" || value.lastGuestCount === null) &&
    (typeof value.lastSyncedAt === "string" || value.lastSyncedAt === null) &&
    typeof value.sourceUrl === "string"
  );
}

async function readHostError(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const payload: unknown = await response.json();

    if (isRecord(payload) && typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}

async function toHostRequestError(
  response: Response,
  fallbackMessage: string,
): Promise<HostRequestError> {
  return new HostRequestError(response.status, await readHostError(response, fallbackMessage));
}
