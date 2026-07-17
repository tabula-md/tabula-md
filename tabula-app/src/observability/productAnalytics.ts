import type { CaptureResult, PostHog } from "posthog-js";
import { tabulaServiceConfig } from "../serviceConfig";

export const PRODUCT_EVENT_NAMES = [
  "app_opened",
  "file_created_or_opened",
  "edited_30_seconds",
  "share_opened",
  "room_created",
  "room_link_copied",
  "agent_invite_copied",
  "collaborator_joined",
  "collaborator_edited",
  "handoff_completed",
  "export_link_created",
  "export_link_loaded",
  "repeat_handoff",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export type ProductEventActorKind = "agent" | "human" | "unknown";
export type ProductDocumentSource = "folder" | "markdown_file" | "new_document";

type ProductEventProperties = {
  actorKind?: ProductEventActorKind;
  documentSource?: ProductDocumentSource;
  roomId?: string;
};

type ProductAnalyticsClient = Pick<PostHog, "capture">;
type ProductAnalyticsStorage = Pick<Storage, "getItem" | "setItem">;

type HandoffHistory = {
  version: 1;
  completions: Array<{ collaborationId: string; completedAt: number }>;
  repeatReportedAt?: number;
};

const INTERNAL_ANALYTICS_STORAGE_KEY = "tabula.analytics.internal";
const COLLABORATION_ID_NAMESPACE = "tabula-product-analytics-v1";
const ACQUISITION_SOURCE_STORAGE_KEY = "tabula.analytics.acquisition-source";
const HANDOFF_HISTORY_STORAGE_KEY = "tabula.analytics.handoff-history";
const HANDOFF_REPEAT_MIN_MS = 24 * 60 * 60 * 1000;
const HANDOFF_REPEAT_WINDOW_MS = 7 * HANDOFF_REPEAT_MIN_MS;
const MAX_HANDOFF_HISTORY_ENTRIES = 20;

const PRODUCT_EVENT_NAME_SET = new Set<ProductEventName>(PRODUCT_EVENT_NAMES);
const PRODUCT_DOCUMENT_SOURCES = new Set<ProductDocumentSource>([
  "folder",
  "markdown_file",
  "new_document",
]);
const EDITING_ACTIVATION_THRESHOLD_MS = 30_000;

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
  PRODUCT_EVENT_NAME_SET.has(value as ProductEventName);

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
  const documentSource = event.properties?.document_source;
  if (
    typeof documentSource === "string" &&
    PRODUCT_DOCUMENT_SOURCES.has(documentSource as ProductDocumentSource)
  ) {
    properties.document_source = documentSource;
  }
  return { ...event, properties } as CaptureResult;
};

export const createEditingActivationTracker = ({
  now = Date.now,
  thresholdMs = EDITING_ACTIVATION_THRESHOLD_MS,
}: {
  now?: () => number;
  thresholdMs?: number;
} = {}) => {
  let firstEditAt: number | null = null;
  let reported = false;

  return {
    recordEdit() {
      if (reported) return false;
      const editedAt = now();
      if (firstEditAt === null) {
        firstEditAt = editedAt;
        return false;
      }
      if (editedAt - firstEditAt < thresholdMs) return false;
      reported = true;
      return true;
    },
  };
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

const readHandoffHistory = (
  storage: ProductAnalyticsStorage,
  now: number,
): HandoffHistory => {
  try {
    const parsed = JSON.parse(storage.getItem(HANDOFF_HISTORY_STORAGE_KEY) ?? "null") as Partial<HandoffHistory> | null;
    const completions = Array.isArray(parsed?.completions)
      ? parsed.completions
        .filter((entry) =>
          typeof entry?.collaborationId === "string" &&
          /^collab_[A-Za-z0-9_-]{22}$/.test(entry.collaborationId) &&
          typeof entry.completedAt === "number" &&
          Number.isFinite(entry.completedAt) &&
          entry.completedAt <= now &&
          now - entry.completedAt <= HANDOFF_REPEAT_WINDOW_MS,
        )
        .slice(-MAX_HANDOFF_HISTORY_ENTRIES)
      : [];
    const repeatReportedAt =
      typeof parsed?.repeatReportedAt === "number" &&
      Number.isFinite(parsed.repeatReportedAt) &&
      parsed.repeatReportedAt <= now &&
      now - parsed.repeatReportedAt <= HANDOFF_REPEAT_WINDOW_MS
        ? parsed.repeatReportedAt
        : undefined;
    return {
      version: 1,
      completions,
      ...(repeatReportedAt !== undefined ? { repeatReportedAt } : {}),
    };
  } catch {
    return { version: 1, completions: [] };
  }
};

export const recordHandoffCompletion = ({
  collaborationId,
  now = Date.now(),
  storage,
}: {
  collaborationId: string;
  now?: number;
  storage?: ProductAnalyticsStorage | null;
}) => {
  if (!storage) return { firstCompletion: true, repeatHandoff: false };
  const history = readHandoffHistory(storage, now);
  if (history.completions.some((entry) => entry.collaborationId === collaborationId)) {
    return { firstCompletion: false, repeatHandoff: false };
  }

  const repeatHandoff =
    history.repeatReportedAt === undefined &&
    history.completions.some((entry) =>
      entry.collaborationId !== collaborationId &&
      now - entry.completedAt >= HANDOFF_REPEAT_MIN_MS,
    );
  const nextHistory: HandoffHistory = {
    version: 1,
    completions: [
      ...history.completions,
      { collaborationId, completedAt: now },
    ].slice(-MAX_HANDOFF_HISTORY_ENTRIES),
    ...(repeatHandoff
      ? { repeatReportedAt: now }
      : history.repeatReportedAt !== undefined
        ? { repeatReportedAt: history.repeatReportedAt }
        : {}),
  };
  try {
    storage.setItem(HANDOFF_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  } catch {
    return { firstCompletion: true, repeatHandoff: false };
  }
  return { firstCompletion: true, repeatHandoff };
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
  handoffStorage,
  now = Date.now,
}: {
  appVersion?: string;
  acquisitionSource?: string;
  client?: ProductAnalyticsClient | null | Promise<ProductAnalyticsClient | null>;
  handoffStorage?: ProductAnalyticsStorage | null;
  now?: () => number;
} = {}) => {
  const loadClient = async () => {
    if (!client) return null;
    return "then" in client ? await client : client;
  };
  const captureWithClient = async (
    loadedClient: ProductAnalyticsClient,
    name: ProductEventName,
    properties: ProductEventProperties = {},
    knownCollaborationId?: string | null,
  ) => {
    const actorKind = properties.actorKind;
    const collaborationId = knownCollaborationId ?? (properties.roomId
      ? await deriveCollaborationId(properties.roomId)
      : null);
    const eventProperties = {
      app_version: appVersion.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32),
      acquisition_source: normalizeAcquisitionSource(acquisitionSource) ?? "direct",
      is_internal: isInternalAnalyticsSession(),
      ...(collaborationId ? { collaboration_id: collaborationId } : {}),
      ...(actorKind === "agent" || actorKind === "human" || actorKind === "unknown"
        ? { actor_kind: actorKind }
        : {}),
      ...(properties.documentSource && PRODUCT_DOCUMENT_SOURCES.has(properties.documentSource)
        ? { document_source: properties.documentSource }
        : {}),
    };
    loadedClient.capture(name, eventProperties);
  };
  const capture = async (
    name: ProductEventName,
    properties: ProductEventProperties = {},
  ) => {
    const loadedClient = await loadClient();
    if (loadedClient) await captureWithClient(loadedClient, name, properties);
  };

  return {
    report(name: ProductEventName, properties: ProductEventProperties = {}) {
      void capture(name, properties);
    },
    reportHandoffCompleted(properties: ProductEventProperties & { roomId: string }) {
      if (!client) return;
      void (async () => {
        const loadedClient = await loadClient();
        if (!loadedClient) return;
        const collaborationId = await deriveCollaborationId(properties.roomId);
        if (!collaborationId) return;
        let storage = handoffStorage ?? null;
        if (handoffStorage === undefined && typeof window !== "undefined") {
          try {
            storage = window.localStorage;
          } catch {
            storage = null;
          }
        }
        const completion = recordHandoffCompletion({
          collaborationId,
          now: now(),
          storage,
        });
        if (!completion.firstCompletion) return;
        await captureWithClient(loadedClient, "handoff_completed", properties, collaborationId);
        if (completion.repeatHandoff) {
          await captureWithClient(loadedClient, "repeat_handoff", properties, collaborationId);
        }
      })();
    },
  };
};

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

let appOpenedReported = false;

export const reportAppOpened = () => {
  if (appOpenedReported) return;
  appOpenedReported = true;
  productAnalytics.report("app_opened");
};
