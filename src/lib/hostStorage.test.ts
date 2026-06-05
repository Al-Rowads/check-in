import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchWithTimeout,
  HostRequestError,
  HostRequestTimeoutError,
  isUnauthorizedHostError,
  resolveApiBaseUrl,
} from "./hostStorage";

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("resolveApiBaseUrl", () => {
  it("uses same-origin API paths when no API URL is configured", () => {
    expect(resolveApiBaseUrl("", "https://check-in.marioiran.info")).toBe("");
  });

  it("collapses the configured deployment domain to a relative API path", () => {
    expect(
      resolveApiBaseUrl(
        "https://check-in.marioiran.info/",
        "https://check-in.marioiran.info",
      ),
    ).toBe("");
  });

  it("keeps a different API origin for local development", () => {
    expect(resolveApiBaseUrl("http://127.0.0.1:4173", "http://localhost:5173")).toBe(
      "http://127.0.0.1:4173",
    );
  });
});

describe("isUnauthorizedHostError", () => {
  it("matches host 401 errors", () => {
    expect(isUnauthorizedHostError(new HostRequestError(401, "Session expired."))).toBe(
      true,
    );
  });

  it("ignores other host or generic errors", () => {
    expect(isUnauthorizedHostError(new HostRequestError(500, "Request failed."))).toBe(
      false,
    );
    expect(isUnauthorizedHostError(new Error("Request failed."))).toBe(false);
  });
});

describe("fetchWithTimeout", () => {
  it("aborts requests that do not finish before the timeout", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;

      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const request = fetchWithTimeout("/api/slow", {}, 100);
    const expectation = expect(request).rejects.toBeInstanceOf(HostRequestTimeoutError);

    await vi.advanceTimersByTimeAsync(100);
    await expectation;
  });

  it("passes through successful responses before the timeout", async () => {
    const response = new Response("ok", { status: 200 });

    globalThis.fetch = vi.fn(async () => response);

    await expect(fetchWithTimeout("/api/health", {}, 100)).resolves.toBe(response);
  });
});
