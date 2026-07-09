import { describe, expect, it } from "vitest";
import {
  TABULA_HOSTED_SERVICE_COPY,
  getTabulaServiceConfig,
  resolveTabulaRoomServiceUrl,
} from "./serviceConfig";

describe("service config", () => {
  it("centralizes hosted service urls and feature flags", () => {
    expect(
      getTabulaServiceConfig({
        DEV: false,
        VITE_TABULA_ERROR_REPORT_URL: "https://events.tabula.test///",
        VITE_TABULA_FIREBASE_CONFIG: " {\"projectId\":\"tabula-test\"} ",
        VITE_TABULA_JSON_URL: "https://json.tabula.test///",
        VITE_TABULA_PLUS_ENABLED: "true",
        VITE_TABULA_PUBLISH_URL: "https://publish.tabula.test/",
        VITE_TABULA_ROOM_URL: "https://rooms.tabula.test//",
      }),
    ).toEqual({
      roomUrl: "https://rooms.tabula.test",
      jsonUrl: "https://json.tabula.test",
      errorReportUrl: "https://events.tabula.test",
      firebaseConfig: "{\"projectId\":\"tabula-test\"}",
      publishUrl: "https://publish.tabula.test",
      plusEnabled: true,
      isDev: false,
      copy: TABULA_HOSTED_SERVICE_COPY,
    });
  });

  it("keeps local room fallback dev-only", () => {
    expect(
      resolveTabulaRoomServiceUrl({
        configuredUrl: null,
        isDev: true,
        location: { hostname: "localhost", protocol: "http:" },
      }),
    ).toBe("http://localhost:3002");

    expect(
      resolveTabulaRoomServiceUrl({
        configuredUrl: null,
        isDev: false,
        location: { hostname: "localhost", protocol: "http:" },
      }),
    ).toBeNull();
  });
});
