import { trimTrailingSlash } from "@tabula-md/tabula";

export const TABULA_LOCAL_ROOM_PORT = 3002;

export const TABULA_HOSTED_SERVICE_COPY = {
  roomUnconfiguredMessage:
    "Live collaboration needs a Tabula Room server. Configure VITE_TABULA_ROOM_URL to start sessions.",
  jsonShareUnconfiguredMessage: "Snapshot links are not configured.",
} as const;

export type TabulaServiceConfig = {
  roomUrl: string | null;
  jsonUrl: string | null;
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
    | "VITE_TABULA_FIREBASE_CONFIG"
    | "VITE_TABULA_JSON_URL"
    | "VITE_TABULA_PLUS_ENABLED"
    | "VITE_TABULA_PUBLISH_URL"
    | "VITE_TABULA_ROOM_URL"
  >
>;

export type RoomServiceLocation = Pick<Location, "hostname" | "protocol">;

export type ResolveTabulaRoomServiceUrlOptions = {
  configuredUrl?: string | null;
  isDev?: boolean;
  location?: RoomServiceLocation;
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
  firebaseConfig: env.VITE_TABULA_FIREBASE_CONFIG?.trim() || null,
  publishUrl: normalizeServiceUrl(env.VITE_TABULA_PUBLISH_URL),
  plusEnabled: isEnabledFlag(env.VITE_TABULA_PLUS_ENABLED),
  isDev: env.DEV === true,
  copy: TABULA_HOSTED_SERVICE_COPY,
});

export const tabulaServiceConfig = getTabulaServiceConfig();

export const resolveTabulaRoomServiceUrl = ({
  configuredUrl = tabulaServiceConfig.roomUrl,
  isDev = tabulaServiceConfig.isDev,
  location,
}: ResolveTabulaRoomServiceUrlOptions = {}) => {
  const configuredBaseUrl = normalizeServiceUrl(configuredUrl);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (!isDev || !location) {
    return null;
  }

  const protocol = location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${location.hostname}:${TABULA_LOCAL_ROOM_PORT}`;
};
