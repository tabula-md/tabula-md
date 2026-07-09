import { describe, expect, it, vi } from "vitest";
import {
  classifyClientError,
  createClientErrorReporter,
  createSanitizedClientErrorReport,
  getClientErrorRouteKind,
} from "./clientErrorReporting";

describe("client error reporting", () => {
  it("classifies share and network failures without depending on raw content", () => {
    expect(classifyClientError(new Error("This export link is missing its client-only key."))).toBe("invalid-link");
    expect(classifyClientError(new Error("This export link was not found or has expired."))).toBe(
      "not-found-or-expired",
    );
    expect(classifyClientError(new Error("Rate limit exceeded"))).toBe("rate-limited");
    expect(classifyClientError(new TypeError("Failed to fetch"))).toBe("network");
  });

  it("derives route kind without exposing room or snapshot ids", () => {
    expect(getClientErrorRouteKind({ hash: "#json=snapshotId,secretKey" })).toBe("json");
    expect(getClientErrorRouteKind({ hash: "#room=roomId,secretKey" })).toBe("room");
    expect(getClientErrorRouteKind({ hash: "" })).toBe("local");
  });

  it("creates a privacy-safe report without document text, ids, hash keys, or raw error messages", () => {
    const report = createSanitizedClientErrorReport(
      {
        feature: "json-share",
        operation: "import",
        error: new Error("Share link failed: decrypt SECRET_KEY and markdown body hello world"),
      },
      {
        appVersion: "0.1.0",
        location: {
          hash: "#json=jsonShare123,SECRET_KEY",
          pathname: "/workspace",
        },
        navigator: { userAgent: "Test Browser\nWith Line Break" },
        now: () => new Date("2026-07-05T00:00:00.000Z"),
      },
    );
    const serialized = JSON.stringify(report);

    expect(report).toEqual({
      appVersion: "0.1.0",
      category: "crypto",
      feature: "json-share",
      operation: "import",
      path: "/workspace",
      routeKind: "json",
      timestamp: "2026-07-05T00:00:00.000Z",
      type: "client-error",
      userAgent: "Test Browser With Line Break",
    });
    expect(serialized).not.toContain("SECRET_KEY");
    expect(serialized).not.toContain("jsonShare123");
    expect(serialized).not.toContain("markdown body");
    expect(serialized).not.toContain("hello world");
  });

  it("is a no-op when no reporting endpoint is configured", () => {
    const fetchImpl = vi.fn();
    const reporter = createClientErrorReporter({ fetchImpl });

    reporter.report({
      feature: "workspace",
      operation: "save",
      error: new Error("anything"),
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts only sanitized payloads when an endpoint is configured", () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const reporter = createClientErrorReporter({
      endpoint: "https://events.tabula.test/client-errors",
      fetchImpl,
      location: { hash: "#room=roomId,SECRET_KEY", pathname: "/doc?ignored=1" },
      navigator: { userAgent: "Test Browser" },
      now: () => new Date("2026-07-05T00:00:00.000Z"),
    });

    reporter.report({
      feature: "collaboration",
      operation: "connect",
      error: new Error("roomId SECRET_KEY failed to fetch"),
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://events.tabula.test/client-errors",
      expect.objectContaining({
        body: JSON.stringify({
          appVersion: "0.1.0",
          category: "network",
          feature: "collaboration",
          operation: "connect",
          path: "/doc",
          routeKind: "room",
          timestamp: "2026-07-05T00:00:00.000Z",
          type: "client-error",
          userAgent: "Test Browser",
        }),
        keepalive: true,
        method: "POST",
      }),
    );
    expect(fetchImpl.mock.calls[0][1].body).not.toContain("SECRET_KEY");
    expect(fetchImpl.mock.calls[0][1].body).not.toContain("roomId");
  });
});
