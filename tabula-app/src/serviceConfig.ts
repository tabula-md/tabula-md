import { trimTrailingSlash } from "@tabula-md/tabula";

export const TABULA_LOCAL_ROOM_PORT = 3002;
export const TABULA_LOCAL_JSON_PORT = 3004;
export const TABULA_LOCAL_FIRESTORE_PORT = 8080;
export const TABULA_LOCAL_FIREBASE_STORAGE_PORT = 9199;
export const TABULA_HOSTED_ROOM_URL = "https://rooms.tabula.md";

const TABULA_LOCAL_FIREBASE_CONFIG = JSON.stringify({
  apiKey: "tabula-local",
  authDomain: "tabula-local.firebaseapp.com",
  projectId: "tabula-local",
  storageBucket: "tabula-local.appspot.com",
  appId: "tabula-local",
});

export const TABULA_HOSTED_SERVICE_COPY = {
  roomUnconfiguredMessage: "Live collaboration is not available right now.",
  jsonShareUnconfiguredMessage: "Export link isn’t available right now.",
} as const;

export type TabulaServiceConfig = {
  roomUrl: string | null;
  jsonUrl: string | null;
  errorReportUrl: string | null;
  posthogKey: string | null;
  firebaseConfig: string | null;
  firebaseEmulatorHost: string | null;
  firestoreEmulatorPort: number;
  firebaseStorageEmulatorPort: number;
  isDev: boolean;
  copy: typeof TABULA_HOSTED_SERVICE_COPY;
};

type TabulaServiceEnv = Partial<
  Pick<
    ImportMetaEnv,
    | "DEV"
    | "VITE_TABULA_ERROR_REPORT_URL"
    | "VITE_POSTHOG_KEY"
    | "VITE_TABULA_FIREBASE_CONFIG"
    | "VITE_TABULA_FIREBASE_EMULATOR_HOST"
    | "VITE_TABULA_FIRESTORE_EMULATOR_PORT"
    | "VITE_TABULA_FIREBASE_STORAGE_EMULATOR_PORT"
    | "VITE_TABULA_JSON_URL"
    | "VITE_TABULA_ROOM_URL"
  >
>;

export type LocalServiceLocation = Pick<Location, "hostname" | "protocol">;
export type RoomServiceLocation = LocalServiceLocation;

export type ResolveTabulaRoomServiceUrlOptions = {
  configuredUrl?: string | null;
  isDev?: boolean;
  location?: LocalServiceLocation;
};

export type ResolveTabulaJsonShareServiceUrlOptions = {
  configuredUrl?: string | null;
  isDev?: boolean;
  location?: LocalServiceLocation;
};

const normalizeServiceUrl = (value?: string | null) => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimTrailingSlash(trimmedValue) : null;
};

const readPort = (value: string | undefined, fallback: number) => {
  const port = Number(value);
  return Number.isSafeInteger(port) && port > 0 && port <= 65_535 ? port : fallback;
};

export const getTabulaServiceConfig = (
  env: TabulaServiceEnv = import.meta.env,
): TabulaServiceConfig => {
  const firebaseEmulatorHost = env.VITE_TABULA_FIREBASE_EMULATOR_HOST?.trim() || null;
  return {
    posthogKey: env.VITE_POSTHOG_KEY?.trim() || null,
    roomUrl: normalizeServiceUrl(env.VITE_TABULA_ROOM_URL),
    jsonUrl: normalizeServiceUrl(env.VITE_TABULA_JSON_URL),
    errorReportUrl: normalizeServiceUrl(env.VITE_TABULA_ERROR_REPORT_URL),
    firebaseConfig:
      env.VITE_TABULA_FIREBASE_CONFIG?.trim() ||
      (env.DEV === true && firebaseEmulatorHost ? TABULA_LOCAL_FIREBASE_CONFIG : null),
    firebaseEmulatorHost,
    firestoreEmulatorPort: readPort(
      env.VITE_TABULA_FIRESTORE_EMULATOR_PORT,
      TABULA_LOCAL_FIRESTORE_PORT,
    ),
    firebaseStorageEmulatorPort: readPort(
      env.VITE_TABULA_FIREBASE_STORAGE_EMULATOR_PORT,
      TABULA_LOCAL_FIREBASE_STORAGE_PORT,
    ),
    isDev: env.DEV === true,
    copy: TABULA_HOSTED_SERVICE_COPY,
  };
};

export const tabulaServiceConfig = getTabulaServiceConfig();

const resolveLocalServiceUrl = ({
  configuredUrl,
  isDev,
  location,
  port,
}: {
  configuredUrl?: string | null;
  isDev: boolean;
  location?: LocalServiceLocation;
  port: number;
}) => {
  const configuredBaseUrl = normalizeServiceUrl(configuredUrl);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (!isDev || !location) {
    return null;
  }

  const protocol = location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${location.hostname}:${port}`;
};

const isOfficialHostedLocation = (location?: LocalServiceLocation) =>
  location?.hostname === "tabula.md" || location?.hostname === "www.tabula.md";

export const resolveTabulaRoomServiceUrl = ({
  configuredUrl = tabulaServiceConfig.roomUrl,
  isDev = tabulaServiceConfig.isDev,
  location,
}: ResolveTabulaRoomServiceUrlOptions = {}) => {
  const configuredBaseUrl = normalizeServiceUrl(configuredUrl);
  if (configuredBaseUrl) return configuredBaseUrl;
  if (isOfficialHostedLocation(location)) return TABULA_HOSTED_ROOM_URL;
  return resolveLocalServiceUrl({
    configuredUrl: null,
    isDev,
    location,
    port: TABULA_LOCAL_ROOM_PORT,
  });
};

export const resolveTabulaJsonShareServiceUrl = ({
  configuredUrl = tabulaServiceConfig.jsonUrl,
  isDev = tabulaServiceConfig.isDev,
  location,
}: ResolveTabulaJsonShareServiceUrlOptions = {}) =>
  resolveLocalServiceUrl({
    configuredUrl,
    isDev,
    location,
    port: TABULA_LOCAL_JSON_PORT,
  });
