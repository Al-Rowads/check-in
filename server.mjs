import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(rootDir, "dist");
const dataDir = path.resolve(process.env.CHECKIN_DATA_DIR ?? path.join(rootDir, "data"));
const uploadsDir = path.join(dataDir, "uploads");
const googleSheetDownloadsDir = path.join(dataDir, "google-sheet-downloads");
const guestsPath = path.join(dataDir, "guests.json");
const activeRosterCsvPath = path.join(dataDir, "active-roster.csv");
const uploadMetadataPath = path.join(dataDir, "latest-upload.json");
const googleSheetSyncPath = path.join(dataDir, "google-sheet-sync.json");
const maxBodyBytes = Number(process.env.CHECKIN_MAX_BODY_BYTES ?? 25 * 1024 * 1024);
const googleSheetSyncIntervalMs = Number(
  process.env.CHECKIN_GOOGLE_SHEET_SYNC_INTERVAL_MS ?? 5 * 60 * 1000,
);
const googleSheetFetchTimeoutMs = Number(
  process.env.CHECKIN_GOOGLE_SHEET_FETCH_TIMEOUT_MS ?? 15000,
);
const staticUsers = [
  {
    password: process.env.CHECKIN_ADMIN_PASSWORD ?? "checkin2026",
    role: "admin",
    username: process.env.CHECKIN_ADMIN_USERNAME ?? "admin",
  },
  {
    password: process.env.CHECKIN_USER_PASSWORD ?? "user2026",
    role: "user",
    username: process.env.CHECKIN_USER_USERNAME ?? "user",
  },
];
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4173);

const allowedUploadExtensions = new Set([".csv", ".xls", ".xlsx"]);
const googleSheetsHost = "docs.google.com";
const COLUMN_ALIASES = {
  name: "name",
  fullname: "name",
  guestname: "name",
  attendee: "name",
  attendeename: "name",
  phone: "phoneNumber",
  phonevalue: "phoneNumber",
  phonenumber: "phoneNumber",
  mobile: "phoneNumber",
  mobilenumber: "phoneNumber",
  cell: "phoneNumber",
  cellphone: "phoneNumber",
  value: "value",
  amount: "value",
  amountpaid: "value",
  paidamount: "value",
  paid: "value",
  payment: "payment",
  paymentstatement: "payment",
  paymentstatus: "payment",
  paidstatus: "payment",
  statement: "statement",
};
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

let googleSheetSyncTimer = null;
let googleSheetSyncInFlight = false;
const authSessions = new Map();

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const server = createServer(async (request, response) => {
  try {
    await handleRequest(request, response);
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const message =
      error instanceof Error && statusCode < 500 ? error.message : "Request failed.";

    if (statusCode >= 500) {
      console.error(error);
    }

    sendJson(response, statusCode, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`Event check-in host server running at http://${host}:${port}`);
  console.log(`Persisting roster data in ${dataDir}`);
});

void initializeGoogleSheetSync();

async function handleRequest(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (requestUrl.pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (requestUrl.pathname === "/api/session" && request.method === "POST") {
    const body = await readJsonBody(request);
    const session = createAuthSession(body.username, body.password);

    if (!session) {
      throw new HttpError(401, "Invalid username or password.");
    }

    sendJson(response, 200, session);
    return;
  }

  if (requestUrl.pathname === "/api/session" && request.method === "DELETE") {
    const session = authenticateRequest(request, ["admin", "user"]);

    authSessions.delete(session.token);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (requestUrl.pathname === "/api/guests" && request.method === "GET") {
    authenticateRequest(request, ["admin", "user"]);
    sendJson(response, 200, { guests: await loadGuests() });
    return;
  }

  if (requestUrl.pathname === "/api/guests" && request.method === "PUT") {
    const session = authenticateRequest(request, ["admin", "user"]);
    const body = await readJsonBody(request);
    const guests = validateGuestsPayload(body.guests);

    const savedGuests =
      session.role === "admin" ? await saveAdminGuestState(guests) : await saveUserGuestState(guests);

    sendJson(response, 200, { guests: savedGuests });
    return;
  }

  if (requestUrl.pathname === "/api/google-sheet-sync" && request.method === "GET") {
    authenticateRequest(request, ["admin", "user"]);
    sendJson(response, 200, { sync: toPublicGoogleSheetSync(await loadGoogleSheetSync()) });
    return;
  }

  if (requestUrl.pathname === "/api/google-sheet-sync" && request.method === "PUT") {
    authenticateRequest(request, ["admin"]);
    const body = await readJsonBody(request);
    const sourceUrl = validateGoogleSheetSourceUrl(body.url ?? body.sourceUrl);
    const sync = await enableGoogleSheetSync(sourceUrl);

    sendJson(response, 200, {
      guests: await loadGuests(),
      sync: toPublicGoogleSheetSync(sync),
    });
    return;
  }

  if (requestUrl.pathname === "/api/google-sheet-sync" && request.method === "DELETE") {
    authenticateRequest(request, ["admin"]);
    const sync = await disableGoogleSheetSync();

    sendJson(response, 200, { sync: toPublicGoogleSheetSync(sync) });
    return;
  }

  if (requestUrl.pathname === "/api/roster-upload" && request.method === "POST") {
    authenticateRequest(request, ["admin"]);
    const body = await readJsonBody(request);
    const upload = validateUploadPayload(body);

    await saveUploadedRoster(upload);
    sendJson(response, 200, { saved: true });
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    throw new HttpError(404, "API route not found.");
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    throw new HttpError(405, "Method not allowed.");
  }

  await serveStaticFile(requestUrl.pathname, request.method, response);
}

async function loadGuests() {
  try {
    const rawGuests = JSON.parse(await readFile(guestsPath, "utf8"));

    return validateGuestsPayload(rawGuests);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function saveAdminGuestState(guests) {
  await saveGuestState(guests);

  return guests;
}

async function saveUserGuestState(guests) {
  const currentGuests = await loadGuests();
  const nextGuests = validateUserGuestChanges(currentGuests, guests);

  await saveGuestState(nextGuests);

  return nextGuests;
}

async function saveGuestState(guests) {
  await mkdir(dataDir, { recursive: true });
  await atomicWriteFile(guestsPath, `${JSON.stringify(guests, null, 2)}\n`);
  await atomicWriteFile(activeRosterCsvPath, buildRosterCsv(guests));
}

async function saveUploadedRoster(upload) {
  await mkdir(uploadsDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const safeFileName = sanitizeFileName(upload.fileName);
  const extension = path.extname(safeFileName).toLowerCase();
  const uploadBuffer = Buffer.from(upload.contentBase64, "base64");
  const historyPath = path.join(
    uploadsDir,
    `${timestamp.replace(/[:.]/g, "-")}-${safeFileName}`,
  );
  const latestUploadPath = path.join(dataDir, `latest-upload${extension || ".csv"}`);

  await atomicWriteFile(historyPath, uploadBuffer);
  await atomicWriteFile(latestUploadPath, uploadBuffer);
  await atomicWriteFile(
    uploadMetadataPath,
    `${JSON.stringify(
      {
        fileName: safeFileName,
        contentType: upload.contentType,
        savedAt: timestamp,
        size: uploadBuffer.byteLength,
      },
      null,
      2,
    )}\n`,
  );
}

async function initializeGoogleSheetSync() {
  try {
    const configuredUrl = process.env.CHECKIN_GOOGLE_SHEET_URL;

    if (configuredUrl) {
      await saveGoogleSheetSync({
        ...createGoogleSheetSyncConfig(configuredUrl),
        updatedAt: new Date().toISOString(),
      });
    }

    const sync = await loadGoogleSheetSync();

    if (sync.enabled) {
      scheduleGoogleSheetSync(sync);
      void syncGoogleSheetRoster("startup").catch((error) => {
        console.error("Google Sheets startup sync failed:", error);
      });
    }
  } catch (error) {
    console.error("Google Sheets sync could not be initialized:", error);
  }
}

async function enableGoogleSheetSync(sourceUrl) {
  const sync = {
    ...createGoogleSheetSyncConfig(sourceUrl),
    updatedAt: new Date().toISOString(),
  };

  await saveGoogleSheetSync(sync);
  scheduleGoogleSheetSync(sync);

  return syncGoogleSheetRoster("manual");
}

async function disableGoogleSheetSync() {
  clearGoogleSheetSyncTimer();

  const sync = {
    ...(await loadGoogleSheetSync()),
    enabled: false,
    updatedAt: new Date().toISOString(),
  };

  await saveGoogleSheetSync(sync);

  return sync;
}

async function syncGoogleSheetRoster(reason) {
  if (googleSheetSyncInFlight) {
    return loadGoogleSheetSync();
  }

  const sync = await loadGoogleSheetSync();

  if (!sync.enabled) {
    return sync;
  }

  googleSheetSyncInFlight = true;

  try {
    const csvText = await downloadGoogleSheetCsv(sync.csvUrl);
    const importResult = parseRosterCsvText(csvText);

    if (importResult.errors.length > 0) {
      throw new HttpError(
        400,
        `Google Sheet has ${importResult.errors.length} import ${importResult.errors.length === 1 ? "error" : "errors"}.`,
      );
    }

    const currentGuests = await loadGuests();
    const guests = refreshServerGuestRoster(currentGuests, importResult.guests);
    const nextSync = {
      ...sync,
      lastError: null,
      lastGuestCount: guests.length,
      lastReason: reason,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveGuestState(guests);
    await saveDownloadedGoogleSheetCsv(csvText);
    await saveGoogleSheetSync(nextSync);

    return nextSync;
  } catch (error) {
    const nextSync = {
      ...sync,
      lastError: error instanceof Error ? error.message : "Google Sheets sync failed.",
      lastReason: reason,
      updatedAt: new Date().toISOString(),
    };

    await saveGoogleSheetSync(nextSync);

    if (reason === "manual") {
      throw error instanceof HttpError ? error : new HttpError(400, nextSync.lastError);
    }

    console.error("Google Sheets sync failed:", error);
    return nextSync;
  } finally {
    googleSheetSyncInFlight = false;
  }
}

async function downloadGoogleSheetCsv(csvUrl) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), googleSheetFetchTimeoutMs);

  try {
    const response = await fetch(csvUrl, {
      headers: {
        Accept: "text/csv,text/plain,*/*",
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new HttpError(
        400,
        `Google Sheet download failed with HTTP ${response.status}.`,
      );
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function saveDownloadedGoogleSheetCsv(csvText) {
  const timestamp = new Date().toISOString();
  const historyPath = path.join(
    googleSheetDownloadsDir,
    `${timestamp.replace(/[:.]/g, "-")}-google-sheet.csv`,
  );

  await atomicWriteFile(path.join(dataDir, "latest-google-sheet.csv"), csvText);
  await atomicWriteFile(historyPath, csvText);
}

async function loadGoogleSheetSync() {
  try {
    const sync = JSON.parse(await readFile(googleSheetSyncPath, "utf8"));

    if (!sync || typeof sync !== "object") {
      return createDisabledGoogleSheetSync();
    }

    return {
      ...createDisabledGoogleSheetSync(),
      ...sync,
      intervalMs:
        typeof sync.intervalMs === "number" && sync.intervalMs > 0
          ? sync.intervalMs
          : googleSheetSyncIntervalMs,
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return createDisabledGoogleSheetSync();
    }

    throw error;
  }
}

async function saveGoogleSheetSync(sync) {
  await atomicWriteFile(googleSheetSyncPath, `${JSON.stringify(sync, null, 2)}\n`);
}

function createGoogleSheetSyncConfig(sourceUrl) {
  const csvUrl = toGoogleSheetsCsvUrl(sourceUrl);

  return {
    csvUrl,
    enabled: true,
    intervalMs: googleSheetSyncIntervalMs,
    lastError: null,
    sourceUrl,
  };
}

function createDisabledGoogleSheetSync() {
  return {
    csvUrl: "",
    enabled: false,
    intervalMs: googleSheetSyncIntervalMs,
    lastError: null,
    sourceUrl: "",
  };
}

function scheduleGoogleSheetSync(sync) {
  clearGoogleSheetSyncTimer();

  if (!sync.enabled) {
    return;
  }

  googleSheetSyncTimer = setInterval(() => {
    void syncGoogleSheetRoster("timer");
  }, sync.intervalMs);
}

function clearGoogleSheetSyncTimer() {
  if (googleSheetSyncTimer) {
    clearInterval(googleSheetSyncTimer);
    googleSheetSyncTimer = null;
  }
}

function toPublicGoogleSheetSync(sync) {
  return {
    enabled: Boolean(sync.enabled),
    intervalMs: sync.intervalMs,
    lastError: sync.lastError ?? null,
    lastGuestCount: sync.lastGuestCount ?? null,
    lastSyncedAt: sync.lastSyncedAt ?? null,
    sourceUrl: sync.sourceUrl ?? "",
  };
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.byteLength;

    if (totalBytes > maxBodyBytes) {
      throw new HttpError(413, "Request body is too large.");
    }

    chunks.push(chunk);
  }

  if (totalBytes === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function createAuthSession(username, password) {
  if (typeof username !== "string" || typeof password !== "string") {
    return null;
  }

  const user = staticUsers.find(
    (currentUser) =>
      currentUser.username === username.trim() && currentUser.password === password,
  );

  if (!user) {
    return null;
  }

  const token = randomUUID();
  const session = {
    role: user.role,
    token,
    username: user.username,
  };

  authSessions.set(token, session);

  return session;
}

function authenticateRequest(request, allowedRoles) {
  const authorizationHeader = request.headers.authorization ?? "";
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new HttpError(401, "Authentication is required.");
  }

  const session = authSessions.get(match[1]);

  if (!session) {
    throw new HttpError(401, "Session is invalid or expired.");
  }

  if (!allowedRoles.includes(session.role)) {
    throw new HttpError(403, "This action requires an admin user.");
  }

  return session;
}

function validateGuestsPayload(value) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "Guests must be an array.");
  }

  return value.map(validateGuest);
}

function validateGuest(value) {
  if (!value || typeof value !== "object") {
    throw new HttpError(400, "Guest entries must be objects.");
  }

  const guest = value;

  requireString(guest.id, "Guest id is required.");
  requireString(guest.name, "Guest name is required.");
  requireString(guest.phoneNumber, "Guest phone number is required.");
  requireString(guest.normalizedPhoneNumber, "Guest normalized phone number is required.");
  requireOneOf(guest.status, ["VIP", "normal"], "Guest status is invalid.");
  requireOneOf(guest.payment, ["full", "not fully paid"], "Guest payment is invalid.");
  requireOneOf(
    guest.checkInState,
    ["not_entered", "entered", "left"],
    "Guest check-in state is invalid.",
  );
  requireString(guest.importedAt, "Guest import timestamp is required.");

  const validatedGuest = {
    id: guest.id,
    name: guest.name,
    phoneNumber: guest.phoneNumber,
    normalizedPhoneNumber: guest.normalizedPhoneNumber,
    status: guest.status,
    payment: guest.payment,
    checkInState: guest.checkInState,
    importedAt: guest.importedAt,
  };

  if (typeof guest.amountPaid === "string" || typeof guest.amountPaid === "number") {
    validatedGuest.amountPaid = guest.amountPaid;
  }

  if (typeof guest.enteredAt === "string") {
    validatedGuest.enteredAt = guest.enteredAt;
  }

  if (typeof guest.leftAt === "string") {
    validatedGuest.leftAt = guest.leftAt;
  }

  return validatedGuest;
}

function validateUserGuestChanges(currentGuests, nextGuests) {
  if (currentGuests.length !== nextGuests.length) {
    throw new HttpError(403, "Normal users cannot add or remove roster entries.");
  }

  const currentGuestsById = currentGuests.reduce((guestsById, guest) => {
    guestsById.set(guest.id, guest);

    return guestsById;
  }, new Map());
  const seenGuestIds = new Set();

  return nextGuests.map((nextGuest) => {
    if (seenGuestIds.has(nextGuest.id)) {
      throw new HttpError(403, "Normal users cannot duplicate roster entries.");
    }

    seenGuestIds.add(nextGuest.id);

    const currentGuest = currentGuestsById.get(nextGuest.id);

    if (!currentGuest) {
      throw new HttpError(403, "Normal users cannot add roster entries.");
    }

    validateUserEditableGuestChange(currentGuest, nextGuest);

    return nextGuest;
  });
}

function validateUserEditableGuestChange(currentGuest, nextGuest) {
  const lockedFields = [
    "id",
    "name",
    "phoneNumber",
    "normalizedPhoneNumber",
    "status",
    "amountPaid",
    "importedAt",
  ];

  lockedFields.forEach((field) => {
    if (!Object.is(currentGuest[field], nextGuest[field])) {
      throw new HttpError(403, "Normal users cannot change roster details.");
    }
  });

  if (
    currentGuest.payment !== nextGuest.payment &&
    (currentGuest.payment !== "not fully paid" || nextGuest.payment !== "full")
  ) {
    throw new HttpError(403, "Normal users cannot reduce payment status.");
  }
}

function validateUploadPayload(value) {
  if (!value || typeof value !== "object") {
    throw new HttpError(400, "Upload payload is required.");
  }

  const fileName = sanitizeFileName(value.fileName);
  const extension = path.extname(fileName).toLowerCase();

  if (!allowedUploadExtensions.has(extension)) {
    throw new HttpError(400, "Upload must be a .csv, .xls, or .xlsx file.");
  }

  if (typeof value.contentBase64 !== "string" || value.contentBase64.length === 0) {
    throw new HttpError(400, "Upload content is required.");
  }

  const uploadBuffer = Buffer.from(value.contentBase64, "base64");

  if (uploadBuffer.byteLength > maxBodyBytes) {
    throw new HttpError(413, "Uploaded roster is too large.");
  }

  return {
    fileName,
    contentType:
      typeof value.contentType === "string" && value.contentType
        ? value.contentType
        : "application/octet-stream",
    contentBase64: uploadBuffer.toString("base64"),
  };
}

function validateGoogleSheetSourceUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "Google Sheets link is required.");
  }

  toGoogleSheetsCsvUrl(value);

  return value.trim();
}

function toGoogleSheetsCsvUrl(sourceUrl) {
  let url;

  try {
    url = new URL(sourceUrl.trim());
  } catch {
    throw new HttpError(400, "Google Sheets link must be a valid URL.");
  }

  if (url.protocol !== "https:" || url.hostname !== googleSheetsHost) {
    throw new HttpError(400, "Use a public https://docs.google.com/spreadsheets link.");
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const spreadsheetsIndex = pathParts.indexOf("spreadsheets");
  const documentIndex = pathParts.indexOf("d");

  if (spreadsheetsIndex === -1 || documentIndex === -1 || !pathParts[documentIndex + 1]) {
    throw new HttpError(400, "The link must be a public Google Sheets document link.");
  }

  const directCsvOutput = url.searchParams.get("output") === "csv";
  const directGvizCsv =
    url.pathname.includes("/gviz/tq") &&
    (url.searchParams.get("tqx") ?? "").includes("out:csv");

  if (directCsvOutput || directGvizCsv) {
    return url.toString();
  }

  const documentId = pathParts[documentIndex + 1];
  const gid = url.searchParams.get("gid") ?? parseGoogleSheetGid(url.hash);
  const sheet = url.searchParams.get("sheet");

  if (documentId === "e") {
    const publishedId = pathParts[documentIndex + 2];

    if (!publishedId) {
      throw new HttpError(400, "The published Google Sheets link is invalid.");
    }

    const csvUrl = new URL(
      `https://${googleSheetsHost}/spreadsheets/d/e/${publishedId}/pub`,
    );

    csvUrl.searchParams.set("output", "csv");

    if (gid) {
      csvUrl.searchParams.set("gid", gid);
    }

    if (sheet) {
      csvUrl.searchParams.set("sheet", sheet);
    }

    return csvUrl.toString();
  }

  const csvUrl = new URL(
    `https://${googleSheetsHost}/spreadsheets/d/${documentId}/export`,
  );

  csvUrl.searchParams.set("format", "csv");

  if (gid) {
    csvUrl.searchParams.set("gid", gid);
  }

  if (sheet) {
    csvUrl.searchParams.set("sheet", sheet);
  }

  return csvUrl.toString();
}

function parseGoogleSheetGid(hash) {
  const match = hash.match(/(?:^#|&)gid=([^&]+)/);

  return match ? decodeURIComponent(match[1]) : "";
}

function refreshServerGuestRoster(currentGuests, candidates) {
  const existingGuestsByKey = groupGuestsByIdentityKey(currentGuests);
  const uniqueExistingGuestsByPhone = getUniqueGuestsByPhone(currentGuests);
  const candidatePhoneCounts = countGuestsByPhone(candidates);
  const matchedGuestIds = new Set();

  return candidates.map((candidate) => {
    const matchedGuest = takeMatchingGuest(
      candidate,
      existingGuestsByKey,
      uniqueExistingGuestsByPhone,
      candidatePhoneCounts,
      matchedGuestIds,
    );
    const guest = {
      ...candidate,
      id: matchedGuest?.id ?? candidate.id ?? randomUUID(),
    };

    if (!matchedGuest) {
      return validateGuest(guest);
    }

    const refreshedGuest = {
      ...guest,
      checkInState: matchedGuest.checkInState,
      payment: matchedGuest.payment === "full" ? "full" : guest.payment,
    };

    if (matchedGuest.enteredAt && matchedGuest.checkInState !== "not_entered") {
      refreshedGuest.enteredAt = matchedGuest.enteredAt;
    }

    if (matchedGuest.leftAt && matchedGuest.checkInState === "left") {
      refreshedGuest.leftAt = matchedGuest.leftAt;
    }

    return validateGuest(refreshedGuest);
  });
}

function groupGuestsByIdentityKey(guests) {
  return guests.reduce((guestsByKey, guest) => {
    const key = getRosterIdentityKey(guest);
    const existingGuests = guestsByKey.get(key);

    if (existingGuests) {
      existingGuests.push(guest);
    } else {
      guestsByKey.set(key, [guest]);
    }

    return guestsByKey;
  }, new Map());
}

function getUniqueGuestsByPhone(guests) {
  const guestsByPhone = guests.reduce((phoneGroups, guest) => {
    const key = getRosterPhoneKey(guest);
    const existingGuests = phoneGroups.get(key);

    if (existingGuests) {
      existingGuests.push(guest);
    } else {
      phoneGroups.set(key, [guest]);
    }

    return phoneGroups;
  }, new Map());

  return Array.from(guestsByPhone.entries()).reduce((uniqueGuests, [phoneKey, phoneGuests]) => {
    if (phoneGuests.length === 1 && phoneGuests[0]) {
      uniqueGuests.set(phoneKey, phoneGuests[0]);
    }

    return uniqueGuests;
  }, new Map());
}

function countGuestsByPhone(guests) {
  return guests.reduce((phoneCounts, guest) => {
    const key = getRosterPhoneKey(guest);

    phoneCounts.set(key, (phoneCounts.get(key) ?? 0) + 1);

    return phoneCounts;
  }, new Map());
}

function takeMatchingGuest(
  candidate,
  existingGuestsByKey,
  uniqueExistingGuestsByPhone,
  candidatePhoneCounts,
  matchedGuestIds,
) {
  const key = getRosterIdentityKey(candidate);
  const exactMatches = existingGuestsByKey.get(key);

  while (exactMatches?.length) {
    const matchedGuest = exactMatches.shift();

    if (matchedGuest && !matchedGuestIds.has(matchedGuest.id)) {
      matchedGuestIds.add(matchedGuest.id);
      return matchedGuest;
    }
  }

  const phoneKey = getRosterPhoneKey(candidate);

  if (candidatePhoneCounts.get(phoneKey) !== 1) {
    return undefined;
  }

  const phoneMatchedGuest = uniqueExistingGuestsByPhone.get(phoneKey);

  if (!phoneMatchedGuest || matchedGuestIds.has(phoneMatchedGuest.id)) {
    return undefined;
  }

  matchedGuestIds.add(phoneMatchedGuest.id);
  return phoneMatchedGuest;
}

function parseRosterCsvText(csvText) {
  const rows = parseCsvRows(csvText).filter((row) =>
    row.some((cell) => normalizeText(cell) !== ""),
  );

  if (rows.length === 0) {
    return {
      errors: [{ rowNumber: 1, messages: ["Worksheet is empty."] }],
      guests: [],
      totalRows: 0,
    };
  }

  const headerMode = getHeaderMode(rows[0] ?? []);

  if (headerMode.errors.length > 0) {
    return {
      errors: [{ rowNumber: 1, messages: headerMode.errors }],
      guests: [],
      totalRows: Math.max(rows.length - 1, 0),
    };
  }

  const importedAt = new Date().toISOString();
  const guests = [];
  const errors = [];
  const dataRows = headerMode.hasHeader ? rows.slice(1) : rows;

  dataRows.forEach((row, index) => {
    const rowNumber = index + (headerMode.hasHeader ? 2 : 1);
    const rowMessages = [];
    const rawName = readCell(row, headerMode.headerMap.name);
    const rawPhone = readCell(row, headerMode.headerMap.phoneNumber);
    const rawValue = readCell(row, headerMode.headerMap.value);
    const rawPayment = firstNonEmptyCell(
      readCell(row, headerMode.headerMap.payment),
      readCell(row, headerMode.headerMap.statement),
    );
    const name = normalizeText(rawName);
    const phoneNumber = normalizeText(rawPhone);
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const rosterValue = normalizeRosterValue(rawValue);
    const payment = normalizePayment(rawPayment);

    if (!name) {
      rowMessages.push("Missing required name.");
    }

    if (!phoneNumber) {
      rowMessages.push("Missing required phone number.");
    }

    if (!normalizedPhoneNumber) {
      rowMessages.push("Phone number is invalid after normalization.");
    }

    if (!rosterValue) {
      rowMessages.push("Missing required value.");
    }

    if (!payment) {
      rowMessages.push("Payment must be full or not fully paid.");
    }

    if (rowMessages.length > 0) {
      errors.push({ rowNumber, messages: rowMessages });
      return;
    }

    const guest = {
      checkInState: "not_entered",
      importedAt,
      name,
      normalizedPhoneNumber,
      payment,
      phoneNumber,
      status: rosterValue.status,
    };

    if (rosterValue.displayValue !== undefined) {
      guest.amountPaid = rosterValue.displayValue;
    }

    guests.push(guest);
  });

  return {
    errors,
    guests,
    totalRows: Math.max(rows.length - 1, 0),
  };
}

function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function getHeaderMode(headerRow) {
  const headerMap = buildHeaderMap(headerRow);
  const knownHeaderCount = Object.keys(headerMap).length;

  if (knownHeaderCount === 0) {
    return {
      errors: [],
      hasHeader: false,
      headerMap: {
        name: 0,
        payment: 3,
        phoneNumber: 1,
        statement: 4,
        value: 2,
      },
    };
  }

  return {
    errors: validateHeaderMap(headerMap),
    hasHeader: true,
    headerMap,
  };
}

function buildHeaderMap(headerRow) {
  return headerRow.reduce((map, header, index) => {
    const canonicalColumn = COLUMN_ALIASES[normalizeHeaderName(header)];

    if (canonicalColumn && map[canonicalColumn] === undefined) {
      map[canonicalColumn] = index;
    }

    return map;
  }, {});
}

function validateHeaderMap(headerMap) {
  const errors = [];

  if (headerMap.name === undefined) {
    errors.push("Missing name column.");
  }

  if (headerMap.phoneNumber === undefined) {
    errors.push("Missing phone number column.");
  }

  if (headerMap.value === undefined) {
    errors.push("Missing value column.");
  }

  if (headerMap.payment === undefined && headerMap.statement === undefined) {
    errors.push("Missing payment or statement column.");
  }

  return errors;
}

function normalizeHeaderName(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function readCell(row, columnIndex) {
  if (columnIndex === undefined) {
    return "";
  }

  return row[columnIndex] ?? "";
}

function firstNonEmptyCell(...values) {
  return values.find((value) => normalizeText(value) !== "") ?? "";
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizePhoneNumber(value) {
  return String(value ?? "").trim().replace(/[\s()+-]/g, "");
}

function normalizeRosterValue(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return undefined;
  }

  if (normalized.toLocaleLowerCase() === "vip") {
    return {
      status: "VIP",
    };
  }

  const numericValue = Number(normalized);

  return {
    displayValue: Number.isFinite(numericValue) ? numericValue : normalized,
    status: "normal",
  };
}

function normalizePayment(value) {
  const normalizedText = normalizeText(value).toLocaleLowerCase();
  const normalizedArabic = normalizedText.replace(/\s+/g, "");
  const normalized = normalizedText.replace(/[^a-z]/g, "");

  if (normalizedArabic === "دفعكامل") {
    return "full";
  }

  if (normalizedArabic === "باقيمبلغ") {
    return "not fully paid";
  }

  if (["full", "paid", "fullypaid", "complete", "completed"].includes(normalized)) {
    return "full";
  }

  if (
    [
      "notfullypaid",
      "notfull",
      "partial",
      "partiallypaid",
      "unpaid",
      "incomplete",
      "pending",
    ].includes(normalized)
  ) {
    return "not fully paid";
  }

  return undefined;
}

function getRosterIdentityKey(guest) {
  return JSON.stringify([guest.normalizedPhoneNumber, normalizeGuestName(guest.name)]);
}

function getRosterPhoneKey(guest) {
  return guest.normalizedPhoneNumber;
}

function normalizeGuestName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function requireString(value, message) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, message);
  }
}

function requireOneOf(value, allowedValues, message) {
  if (!allowedValues.includes(value)) {
    throw new HttpError(400, message);
  }
}

async function serveStaticFile(pathname, method, response) {
  const decodedPathname = decodeURIComponent(pathname);
  const requestedPath = decodedPathname === "/" ? "/index.html" : decodedPathname;
  const staticPath = path.resolve(distDir, `.${requestedPath}`);

  if (!staticPath.startsWith(`${distDir}${path.sep}`) && staticPath !== distDir) {
    throw new HttpError(403, "Forbidden.");
  }

  const filePath = await getStaticFilePath(staticPath);
  const extension = path.extname(filePath).toLowerCase();
  const contentType = contentTypes.get(extension) ?? "application/octet-stream";

  response.writeHead(200, {
    "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=31536000, immutable",
    "Content-Type": contentType,
  });

  if (method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

async function getStaticFilePath(staticPath) {
  try {
    const fileStat = await stat(staticPath);

    if (fileStat.isFile()) {
      return staticPath;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  return path.join(distDir, "index.html");
}

async function atomicWriteFile(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });

  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
  );

  await writeFile(temporaryPath, data);
  await rename(temporaryPath, filePath);
}

function buildRosterCsv(guests) {
  const rows = [
    [
      "name",
      "phone",
      "value",
      "status",
      "payment",
      "checkInState",
      "enteredAt",
      "leftAt",
      "importedAt",
    ],
    ...guests.map((guest) => [
      guest.name,
      guest.phoneNumber,
      getGuestRosterValue(guest),
      guest.status,
      guest.payment,
      guest.checkInState,
      guest.enteredAt ?? "",
      guest.leftAt ?? "",
      guest.importedAt,
    ]),
  ];

  return `${rows.map((row) => row.map(formatCsvCell).join(",")).join("\n")}\n`;
}

function getGuestRosterValue(guest) {
  if (guest.amountPaid !== undefined && guest.amountPaid !== "") {
    return guest.amountPaid;
  }

  return guest.status === "VIP" ? "vip" : "";
}

function formatCsvCell(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function sanitizeFileName(fileName) {
  const fallbackFileName = "roster.csv";
  const baseName = path.basename(String(fileName ?? fallbackFileName));
  const safeName = baseName.replace(/[^\w. -]/g, "_").trim();

  return safeName || fallbackFileName;
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "DELETE, GET, PUT, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Origin", "*");
}
