import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { Guest } from "../types/guest";

type TestServer = {
  baseUrl: string;
  dataDir: string;
  output: () => string;
  process: ChildProcessWithoutNullStreams;
};

type ApiResponse<T> = {
  payload: T;
  status: number;
};

type SessionResponse = {
  role: "admin" | "user";
  token: string;
  username: string;
};

type GuestsResponse = {
  guests: Guest[];
};

let testServer: TestServer | undefined;

afterEach(async () => {
  if (!testServer) {
    return;
  }

  await stopTestServer(testServer);
  testServer = undefined;
});

describe("server guest state actions", () => {
  it("keeps check-ins from concurrent stale devices using the same user account", async () => {
    const server = await setupServer();
    const adminToken = await login(server, "admin", "checkin2026");
    const firstUserToken = await login(server, "user", "user2026");
    const secondUserToken = await login(server, "user", "user2026");

    await putGuests(server, adminToken, [
      makeGuest("guest-1", "Ava Stone"),
      makeGuest("guest-2", "Mia Reed"),
    ]);
    await getGuests(server, firstUserToken);
    await getGuests(server, secondUserToken);

    const [firstResponse, secondResponse] = await Promise.all([
      patchCheckIn(server, firstUserToken, "guest-1", "entered"),
      patchCheckIn(server, secondUserToken, "guest-2", "entered"),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    const finalGuests = await getGuests(server, firstUserToken);

    expect(findGuest(finalGuests, "guest-1")).toMatchObject({
      checkInState: "entered",
    });
    expect(findGuest(finalGuests, "guest-1").enteredAt).toEqual(expect.any(String));
    expect(findGuest(finalGuests, "guest-2")).toMatchObject({
      checkInState: "entered",
    });
    expect(findGuest(finalGuests, "guest-2").enteredAt).toEqual(expect.any(String));
  });

  it("rejects normal user full-roster PUT saves", async () => {
    const server = await setupServer();
    const userToken = await login(server, "user", "user2026");
    const response = await apiRequest(server, "/api/guests", {
      authToken: userToken,
      body: { guests: [] },
      method: "PUT",
    });

    expect(response.status).toBe(403);
  });

  it("rejects invalid check-in states and unknown guest IDs", async () => {
    const server = await setupServer();
    const adminToken = await login(server, "admin", "checkin2026");
    const userToken = await login(server, "user", "user2026");

    await putGuests(server, adminToken, [makeGuest("guest-1", "Ava Stone")]);

    const invalidStateResponse = await apiRequest(server, "/api/guests/guest-1/check-in", {
      authToken: userToken,
      body: { nextState: "left" },
      method: "PATCH",
    });
    const unknownGuestResponse = await patchCheckIn(
      server,
      userToken,
      "missing-guest",
      "entered",
    );

    expect(invalidStateResponse.status).toBe(400);
    expect(unknownGuestResponse.status).toBe(404);
  });

  it("generates entered timestamps on the server and ignores client timestamps", async () => {
    const server = await setupServer();
    const adminToken = await login(server, "admin", "checkin2026");
    const userToken = await login(server, "user", "user2026");
    const clientTimestamp = "2000-01-01T00:00:00.000Z";

    await putGuests(server, adminToken, [makeGuest("guest-1", "Ava Stone")]);

    const response = await apiRequest<GuestsResponse>(
      server,
      "/api/guests/guest-1/check-in",
      {
        authToken: userToken,
        body: { enteredAt: clientTimestamp, nextState: "entered" },
        method: "PATCH",
      },
    );
    const guest = findGuest(response.payload.guests, "guest-1");

    expect(response.status).toBe(200);
    expect(guest.enteredAt).toEqual(expect.any(String));
    expect(guest.enteredAt).not.toBe(clientTimestamp);
    expect(Date.parse(guest.enteredAt ?? "")).not.toBeNaN();
  });

  it("preserves the original entered timestamp on duplicate entered actions", async () => {
    const server = await setupServer();
    const adminToken = await login(server, "admin", "checkin2026");
    const userToken = await login(server, "user", "user2026");

    await putGuests(server, adminToken, [makeGuest("guest-1", "Ava Stone")]);

    const firstResponse = await patchCheckIn(server, userToken, "guest-1", "entered");
    await delay(20);
    const secondResponse = await patchCheckIn(server, userToken, "guest-1", "entered");
    const firstEnteredAt = findGuest(firstResponse.payload.guests, "guest-1").enteredAt;
    const secondEnteredAt = findGuest(secondResponse.payload.guests, "guest-1").enteredAt;

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondEnteredAt).toBe(firstEnteredAt);
  });

  it("allows normal users to reset check-in state and clears timestamps", async () => {
    const server = await setupServer();
    const adminToken = await login(server, "admin", "checkin2026");
    const userToken = await login(server, "user", "user2026");

    await putGuests(server, adminToken, [
      {
        ...makeGuest("guest-1", "Ava Stone"),
        checkInState: "left",
        enteredAt: "2026-06-05T10:00:00.000Z",
        leftAt: "2026-06-05T11:00:00.000Z",
      },
    ]);

    const response = await patchCheckIn(server, userToken, "guest-1", "not_entered");
    const guest = findGuest(response.payload.guests, "guest-1");

    expect(response.status).toBe(200);
    expect(guest.checkInState).toBe("not_entered");
    expect(guest.enteredAt).toBeUndefined();
    expect(guest.leftAt).toBeUndefined();
  });

  it("preserves payment and check-in changes made concurrently", async () => {
    const server = await setupServer();
    const adminToken = await login(server, "admin", "checkin2026");
    const firstUserToken = await login(server, "user", "user2026");
    const secondUserToken = await login(server, "user", "user2026");

    await putGuests(server, adminToken, [makeGuest("guest-1", "Ava Stone")]);

    const [paymentResponse, checkInResponse] = await Promise.all([
      patchPayment(server, firstUserToken, "guest-1"),
      patchCheckIn(server, secondUserToken, "guest-1", "entered"),
    ]);

    expect(paymentResponse.status).toBe(200);
    expect(checkInResponse.status).toBe(200);

    const finalGuest = findGuest(await getGuests(server, firstUserToken), "guest-1");

    expect(finalGuest).toMatchObject({
      checkInState: "entered",
      payment: "full",
    });
    expect(finalGuest.enteredAt).toEqual(expect.any(String));
  });

  it("keeps backend progress when an admin saves a stale roster", async () => {
    const server = await setupServer();
    const adminToken = await login(server, "admin", "checkin2026");
    const userToken = await login(server, "user", "user2026");

    await putGuests(server, adminToken, [makeGuest("guest-1", "Ava Stone")]);
    const staleGuests = await getGuests(server, adminToken);

    await patchCheckIn(server, userToken, "guest-1", "entered");
    await patchPayment(server, userToken, "guest-1");

    const adminSaveResponse = await putGuests(server, adminToken, staleGuests);
    const guest = findGuest(adminSaveResponse.payload.guests, "guest-1");

    expect(adminSaveResponse.status).toBe(200);
    expect(guest).toMatchObject({
      checkInState: "entered",
      payment: "full",
    });
    expect(guest.enteredAt).toEqual(expect.any(String));
  });

  it("exports only entered guests as CSV for admins", async () => {
    const server = await setupServer();
    const adminToken = await login(server, "admin", "checkin2026");

    await putGuests(server, adminToken, [
      {
        ...makeGuest("guest-1", "Ava Stone"),
        checkInState: "entered",
        enteredAt: "2026-06-05T10:00:00.000Z",
      },
      makeGuest("guest-2", "Mia Reed"),
      {
        ...makeGuest("guest-3", "Noah Vale"),
        checkInState: "left",
        enteredAt: "2026-06-05T09:00:00.000Z",
        leftAt: "2026-06-05T11:00:00.000Z",
      },
    ]);

    const response = await textRequest(server, "/api/guests/export/entered.csv", {
      authToken: adminToken,
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.text).toContain("name,phone,value,status,payment,checkInState,enteredAt,leftAt,importedAt");
    expect(response.text).toContain("Ava Stone");
    expect(response.text).toContain("entered");
    expect(response.text).not.toContain("Mia Reed");
    expect(response.text).not.toContain("Noah Vale");
  });

  it("blocks normal users from exporting entered guests CSV", async () => {
    const server = await setupServer();
    const userToken = await login(server, "user", "user2026");
    const response = await textRequest(server, "/api/guests/export/entered.csv", {
      authToken: userToken,
      method: "GET",
    });

    expect(response.status).toBe(403);
  });
});

async function setupServer(): Promise<TestServer> {
  testServer = await startTestServer();
  return testServer;
}

async function startTestServer(): Promise<TestServer> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "check-in-server-"));
  const port = await getAvailablePort();
  const outputChunks: string[] = [];
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CHECKIN_DATA_DIR: dataDir,
      HOST: "127.0.0.1",
      PORT: String(port),
    },
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = () => outputChunks.join("");

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => outputChunks.push(chunk));
  child.stderr.on("data", (chunk: string) => outputChunks.push(chunk));

  const server = {
    baseUrl,
    dataDir,
    output,
    process: child,
  };

  await waitForHealth(server);

  return server;
}

async function stopTestServer(server: TestServer): Promise<void> {
  if (server.process.exitCode === null) {
    server.process.kill();
    await Promise.race([
      once(server.process, "exit"),
      delay(1000).then(() => {
        if (server.process.exitCode === null) {
          server.process.kill("SIGKILL");
        }
      }),
    ]);
  }

  await rm(server.dataDir, { force: true, recursive: true });
}

async function waitForHealth(server: TestServer): Promise<void> {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    if (server.process.exitCode !== null) {
      throw new Error(`Server exited before startup.\n${server.output()}`);
    }

    try {
      const response = await fetch(`${server.baseUrl}/api/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the server starts or the deadline expires.
    }

    await delay(50);
  }

  throw new Error(`Server did not start.\n${server.output()}`);
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;

      server.close(() => resolve(port));
    });
  });
}

async function login(
  server: TestServer,
  username: "admin" | "user",
  password: string,
): Promise<string> {
  const response = await apiRequest<SessionResponse>(server, "/api/session", {
    body: { password, username },
    method: "POST",
  });

  expect(response.status).toBe(200);
  return response.payload.token;
}

async function getGuests(server: TestServer, authToken: string): Promise<Guest[]> {
  const response = await apiRequest<GuestsResponse>(server, "/api/guests", {
    authToken,
    method: "GET",
  });

  expect(response.status).toBe(200);
  return response.payload.guests;
}

async function putGuests(
  server: TestServer,
  authToken: string,
  guests: Guest[],
): Promise<ApiResponse<GuestsResponse>> {
  const response = await apiRequest<GuestsResponse>(server, "/api/guests", {
    authToken,
    body: { guests },
    method: "PUT",
  });

  expect(response.status).toBe(200);
  return response;
}

function patchCheckIn(
  server: TestServer,
  authToken: string,
  guestId: string,
  nextState: "entered" | "not_entered",
): Promise<ApiResponse<GuestsResponse>> {
  return apiRequest<GuestsResponse>(server, `/api/guests/${guestId}/check-in`, {
    authToken,
    body: { nextState },
    method: "PATCH",
  });
}

function patchPayment(
  server: TestServer,
  authToken: string,
  guestId: string,
): Promise<ApiResponse<GuestsResponse>> {
  return apiRequest<GuestsResponse>(server, `/api/guests/${guestId}/payment`, {
    authToken,
    body: { payment: "full" },
    method: "PATCH",
  });
}

async function apiRequest<T>(
  server: TestServer,
  pathname: string,
  options: {
    authToken?: string;
    body?: unknown;
    method: "GET" | "PATCH" | "POST" | "PUT";
  },
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};

  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const requestInit: RequestInit = {
    headers,
    method: options.method,
  };

  if (options.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${server.baseUrl}${pathname}`, requestInit);
  const payload = (await response.json()) as T;

  return {
    payload,
    status: response.status,
  };
}

async function textRequest(
  server: TestServer,
  pathname: string,
  options: {
    authToken?: string;
    method: "GET";
  },
): Promise<{ headers: Headers; status: number; text: string }> {
  const headers: Record<string, string> = {};

  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }

  const response = await fetch(`${server.baseUrl}${pathname}`, {
    headers,
    method: options.method,
  });

  return {
    headers: response.headers,
    status: response.status,
    text: await response.text(),
  };
}

function makeGuest(id: string, name: string): Guest {
  return {
    checkInState: "not_entered",
    id,
    importedAt: "2026-06-05T00:00:00.000Z",
    name,
    normalizedPhoneNumber: id.replace(/\D/g, "") || id,
    payment: "not fully paid",
    phoneNumber: id,
    status: "normal",
  };
}

function findGuest(guests: Guest[], guestId: string): Guest {
  const guest = guests.find((currentGuest) => currentGuest.id === guestId);

  if (!guest) {
    throw new Error(`Guest ${guestId} was not found.`);
  }

  return guest;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
