import { trimTrailingSlash } from "@tabula-md/tabula";

export const TABULA_LOCAL_ROOM_PORT = 3002;
export const TABULA_LOCAL_JSON_PORT = 3004;

export const TABULA_HOSTED_SERVICE_COPY = {
  roomUnconfiguredMessage:
    "Live collaboration needs a Tabula Room server. Configure VITE_TABULA_ROOM_URL to start sessions.",
  jsonShareUnconfiguredMessage: "Export link service is not available.",
  roomCheckpointUnconfiguredMessage:
    "Live room persistence needs Firebase. Configure VITE_TABULA_FIREBASE_CONFIG to restore rooms without an active peer.",
} as const;

export type TabulaServiceConfig = {
  roomUrl: string | null;
  jsonUrl: string | null;
  errorReportUrl: string | null;
  firebaseConfig: string | null;
  publishUrl: string | null;
  plusEnabled: boolean;
  isDev: boolean;
  copy: typeof TABULA_HOSTED_SERVICE_COPY;
};

type TabulaServiceEnv = Partial<
  Pick<
    ImportMetaEnv,
    | "DEV"
    | "VITE_TABULA_ERROR_REPORT_URL"
    | "VITE_TABULA_FIREBASE_CONFIG"
    | "VITE_TABULA_JSON_URL"
    | "VITE_TABULA_PLUS_ENABLED"
    | "VITE_TABULA_PUBLISH_URL"
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

const isEnabledFlag = (value?: string) => value === "1" || value === "true";

export const getTabulaServiceConfig = (
  env: TabulaServiceEnv = import.meta.env,
): TabulaServiceConfig => ({
  roomUrl: normalizeServiceUrl(env.VITE_TABULA_ROOM_URL),
  jsonUrl: normalizeServiceUrl(env.VITE_TABULA_JSON_URL),
  errorReportUrl: normalizeServiceUrl(env.VITE_TABULA_ERROR_REPORT_URL),
  firebaseConfig: env.VITE_TABULA_FIREBASE_CONFIG?.trim() || null,
  publishUrl: normalizeServiceUrl(env.VITE_TABULA_PUBLISH_URL),
  plusEnabled: isEnabledFlag(env.VITE_TABULA_PLUS_ENABLED),
  isDev: env.DEV === true,
  copy: TABULA_HOSTED_SERVICE_COPY,
});

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

export const resolveTabulaRoomServiceUrl = ({
  configuredUrl = tabulaServiceConfig.roomUrl,
  isDev = tabulaServiceConfig.isDev,
  location,
}: ResolveTabulaRoomServiceUrlOptions = {}) =>
  resolveLocalServiceUrl({
    configuredUrl,
    isDev,
    location,
    port: TABULA_LOCAL_ROOM_PORT,
  });

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
