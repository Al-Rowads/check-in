import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./hostStorage";

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
