import { describe, expect, it } from "vitest";
import {
  TABULA_HOSTED_ROOM_URL,
  TABULA_HOSTED_SERVICE_COPY,
  getTabulaServiceConfig,
  resolveTabulaJsonShareServiceUrl,
  resolveTabulaRoomServiceUrl,
} from "./serviceConfig";

describe("service config", () => {
  it("centralizes hosted service urls and feature flags", () => {
    expect(
      getTabulaServiceConfig({
        DEV: false,
        VITE_POSTHOG_KEY: " phc_test_key ",
        VITE_TABULA_ERROR_REPORT_URL: "https://events.tabula.test///",
        VITE_TABULA_FIREBASE_CONFIG: "{\"projectId\":\"tabula-test\"}",
        VITE_TABULA_JSON_URL: "https://json.tabula.test///",
        VITE_TABULA_ROOM_URL: "https://rooms.tabula.test//",
      }),
    ).toEqual({
      posthogKey: "phc_test_key",
      roomUrl: "https://rooms.tabula.test",
      jsonUrl: "https://json.tabula.test",
      errorReportUrl: "https://events.tabula.test",
      firebaseConfig: "{\"projectId\":\"tabula-test\"}",
      firebaseEmulatorHost: null,
      firestoreEmulatorPort: 8080,
      firebaseStorageEmulatorPort: 9199,
      isDev: false,
      copy: TABULA_HOSTED_SERVICE_COPY,
    });
  });

  it("uses a local Firebase config only when the emulator is explicit", () => {
    const config = getTabulaServiceConfig({
      DEV: true,
      VITE_TABULA_FIREBASE_EMULATOR_HOST: "127.0.0.1",
    });

    expect(config.firebaseConfig).toContain('"projectId":"tabula-local"');
    expect(config.firebaseEmulatorHost).toBe("127.0.0.1");
    expect(config.firestoreEmulatorPort).toBe(8080);
    expect(config.firebaseStorageEmulatorPort).toBe(9199);
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

  it("uses the official hosted room service when deployment config is missing", () => {
    expect(
      resolveTabulaRoomServiceUrl({
        configuredUrl: null,
        isDev: false,
        location: { hostname: "tabula.md", protocol: "https:" },
      }),
    ).toBe(TABULA_HOSTED_ROOM_URL);
    expect(
      resolveTabulaRoomServiceUrl({
        configuredUrl: null,
        isDev: false,
        location: { hostname: "www.tabula.md", protocol: "https:" },
      }),
    ).toBe(TABULA_HOSTED_ROOM_URL);
  });

  it("keeps local export link storage fallback dev-only", () => {
    expect(
      resolveTabulaJsonShareServiceUrl({
        configuredUrl: null,
        isDev: true,
        location: { hostname: "localhost", protocol: "http:" },
      }),
    ).toBe("http://localhost:3004");

    expect(
      resolveTabulaJsonShareServiceUrl({
        configuredUrl: null,
        isDev: false,
        location: { hostname: "localhost", protocol: "http:" },
      }),
    ).toBeNull();

    expect(
      resolveTabulaJsonShareServiceUrl({
        configuredUrl: "https://json.tabula.test///",
        isDev: true,
        location: { hostname: "localhost", protocol: "http:" },
      }),
    ).toBe("https://json.tabula.test");
  });
});
