import { describe, expect, it } from "vitest";
import { HostRequestError, isUnauthorizedHostError, resolveApiBaseUrl } from "./hostStorage";

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
