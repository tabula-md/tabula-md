import type { CaptureResult, PostHog } from "posthog-js";
import { tabulaServiceConfig } from "../serviceConfig";

export type ProductEventName =
  | "app_opened"
  | "room_created"
  | "room_link_copied"
  | "agent_invite_copied"
  | "collaborator_joined"
  | "collaborator_edited";

export type ProductEventActorKind = "agent" | "human" | "unknown";

type ProductEventProperties = {
  actorKind?: ProductEventActorKind;
  roomId?: string;
};

type ProductAnalyticsClient = Pick<PostHog, "capture">;

const INTERNAL_ANALYTICS_STORAGE_KEY = "tabula.analytics.internal";
const COLLABORATION_ID_NAMESPACE = "tabula-product-analytics-v1";
const ACQUISITION_SOURCE_STORAGE_KEY = "tabula.analytics.acquisition-source";

const PRODUCT_EVENT_NAMES = new Set<ProductEventName>([
  "app_opened",
  "room_created",
  "room_link_copied",
  "agent_invite_copied",
  "collaborator_joined",
  "collaborator_edited",
]);

export const normalizeAcquisitionSource = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-z0-9_-]{1,32}$/.test(normalized) ? normalized : null;
};

const readAcquisitionSource = () => {
  if (typeof window === "undefined") return "direct";
  try {
    const stored = normalizeAcquisitionSource(
      window.sessionStorage.getItem(ACQUISITION_SOURCE_STORAGE_KEY),
    );
    if (stored) return stored;
    const source = normalizeAcquisitionSource(new URLSearchParams(window.location.search).get("ref"))
      ?? "direct";
    window.sessionStorage.setItem(ACQUISITION_SOURCE_STORAGE_KEY, source);
    return source;
  } catch {
    return "direct";
  }
};

const isProductEventName = (value: string): value is ProductEventName =>
  PRODUCT_EVENT_NAMES.has(value as ProductEventName);

const copyProperty = (
  target: Record<string, unknown>,
  source: CaptureResult["properties"],
  key: string,
) => {
  const value = source?.[key];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    target[key] = value;
  }
};

export const sanitizePostHogProductEvent = (event: CaptureResult | null): CaptureResult | null => {
  if (!event || !isProductEventName(event.event)) return null;
  const properties: Record<string, unknown> = {};
  for (const key of [
    "token",
    "distinct_id",
    "$session_id",
    "$process_person_profile",
    "app_version",
    "actor_kind",
    "collaboration_id",
    "is_internal",
    "acquisition_source",
  ]) {
    copyProperty(properties, event.properties, key);
  }
  return { ...event, properties } as CaptureResult;
};

const encodeBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const deriveCollaborationId = async (roomId: string): Promise<string | null> => {
  const normalizedRoomId = roomId.trim();
  if (!normalizedRoomId || typeof crypto === "undefined" || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${COLLABORATION_ID_NAMESPACE}:${normalizedRoomId}`),
  );
  return `collab_${encodeBase64Url(new Uint8Array(digest).slice(0, 16))}`;
};

const isInternalAnalyticsSession = () => {
  if (typeof window === "undefined") return false;
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return true;
  try {
    return window.localStorage.getItem(INTERNAL_ANALYTICS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const createProductAnalytics = ({
  appVersion = "0.1.0",
  acquisitionSource = readAcquisitionSource(),
  client,
}: {
  appVersion?: string;
  acquisitionSource?: string;
  client?: ProductAnalyticsClient | null | Promise<ProductAnalyticsClient | null>;
} = {}) => ({
  report(name: ProductEventName, properties: ProductEventProperties = {}) {
    if (!client) return;
    void (async () => {
      const actorKind = properties.actorKind;
      const collaborationId = properties.roomId
        ? await deriveCollaborationId(properties.roomId)
        : null;
      const eventProperties = {
        app_version: appVersion.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32),
        acquisition_source: normalizeAcquisitionSource(acquisitionSource) ?? "direct",
        is_internal: isInternalAnalyticsSession(),
        ...(collaborationId ? { collaboration_id: collaborationId } : {}),
        ...(actorKind === "agent" || actorKind === "human" || actorKind === "unknown"
          ? { actor_kind: actorKind }
          : {}),
      };
      const loadedClient = "then" in client ? await client : client;
      loadedClient?.capture(name, eventProperties);
    })();
  },
});

export const initializeProductAnalytics = async (
  projectKey = tabulaServiceConfig.posthogKey,
): Promise<ProductAnalyticsClient | null> => {
  if (!projectKey || typeof window === "undefined") return null;
  const { default: posthog } = await import("posthog-js");
  return posthog.init(projectKey, {
    api_host: "https://us.i.posthog.com",
    advanced_disable_flags: true,
    autocapture: false,
    before_send: sanitizePostHogProductEvent,
    capture_dead_clicks: false,
    capture_pageleave: false,
    capture_pageview: false,
    disable_session_recording: true,
    disable_surveys: true,
    enable_heatmaps: false,
    mask_all_element_attributes: true,
    mask_all_text: true,
    persistence: "sessionStorage",
    person_profiles: "identified_only",
    rageclick: false,
    respect_dnt: true,
  });
};

export const productAnalytics = createProductAnalytics({
  client: initializeProductAnalytics(),
});

productAnalytics.report("app_opened");
