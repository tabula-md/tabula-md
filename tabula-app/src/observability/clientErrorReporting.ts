import { tabulaServiceConfig } from "../serviceConfig";

export type ClientErrorFeature =
  | "collaboration"
  | "firebase-recovery"
  | "json-share"
  | "markdown-preview"
  | "workspace";

export type ClientErrorCategory =
  | "crypto"
  | "invalid-link"
  | "network"
  | "not-found-or-expired"
  | "rate-limited"
  | "unknown";

export type ClientErrorRouteKind = "json" | "local" | "room" | "unknown";

export type ClientErrorReportInput = {
  error?: unknown;
  feature: ClientErrorFeature;
  operation: string;
};

export type SanitizedClientErrorReport = {
  appVersion: string;
  category: ClientErrorCategory;
  feature: ClientErrorFeature;
  operation: string;
  path: string;
  routeKind: ClientErrorRouteKind;
  timestamp: string;
  type: "client-error";
  userAgent: string;
};

export type ClientErrorReporterOptions = {
  appVersion?: string;
  endpoint?: string | null;
  fetchImpl?: typeof fetch;
  location?: Pick<Location, "hash" | "pathname">;
  navigator?: Pick<Navigator, "userAgent">;
  now?: () => Date;
};

const unknownUserAgent = "unknown";
const maxOperationLength = 80;

export const classifyClientError = (error: unknown): ClientErrorCategory => {
  const message = getErrorMessage(error).toLowerCase();
  const name = error instanceof Error ? error.name.toLowerCase() : "";

  if (name.includes("operationerror") || message.includes("decrypt") || message.includes("crypto")) {
    return "crypto";
  }
  if (message.includes("missing") && message.includes("key")) {
    return "invalid-link";
  }
  if (message.includes("invalid") && (message.includes("key") || message.includes("link"))) {
    return "invalid-link";
  }
  if (message.includes("not found") || message.includes("expired") || message.includes("404")) {
    return "not-found-or-expired";
  }
  if (message.includes("rate limit") || message.includes("too many") || message.includes("429")) {
    return "rate-limited";
  }
  if (error instanceof TypeError || message.includes("network") || message.includes("failed to fetch")) {
    return "network";
  }
  return "unknown";
};

export const getClientErrorRouteKind = (location?: Pick<Location, "hash">): ClientErrorRouteKind => {
  const hash = location?.hash ?? "";
  if (hash.startsWith("#json=")) {
    return "json";
  }
  if (hash.startsWith("#room=")) {
    return "room";
  }
  if (!hash) {
    return "local";
  }
  return "unknown";
};

export const createSanitizedClientErrorReport = (
  input: ClientErrorReportInput,
  options: ClientErrorReporterOptions = {},
): SanitizedClientErrorReport => ({
  appVersion: sanitizeBoundedText(options.appVersion ?? "0.1.0", 32),
  category: classifyClientError(input.error),
  feature: input.feature,
  operation: sanitizeBoundedText(input.operation, maxOperationLength),
  path: sanitizePath(options.location?.pathname),
  routeKind: getClientErrorRouteKind(options.location),
  timestamp: (options.now ?? (() => new Date()))().toISOString(),
  type: "client-error",
  userAgent: sanitizeBoundedText(options.navigator?.userAgent ?? unknownUserAgent, 160),
});

export const createClientErrorReporter = (options: ClientErrorReporterOptions = {}) => ({
  report(input: ClientErrorReportInput) {
    if (!options.endpoint || !options.fetchImpl) {
      return;
    }

    const payload = createSanitizedClientErrorReport(input, options);
    void options
      .fetchImpl(options.endpoint, {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        keepalive: true,
        method: "POST",
      })
      .catch(() => undefined);
  },
});

export const clientErrorReporter = createClientErrorReporter({
  endpoint: tabulaServiceConfig.errorReportUrl,
  fetchImpl: typeof fetch === "function" ? fetch.bind(globalThis) : undefined,
  location: typeof window !== "undefined" ? window.location : undefined,
  navigator: typeof navigator !== "undefined" ? navigator : undefined,
});

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

function sanitizePath(pathname: string | undefined) {
  const pathnameOnly = pathname?.split(/[?#]/)[0] ?? "/";
  return pathnameOnly.startsWith("/") ? pathnameOnly : "/";
}

function sanitizeBoundedText(value: string, maxLength: number) {
  return value.replace(/[\r\n\t]/g, " ").slice(0, maxLength);
}
