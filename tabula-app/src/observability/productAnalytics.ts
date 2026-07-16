import type { CaptureResult, PostHog } from "posthog-js";
import { tabulaServiceConfig } from "../serviceConfig";

export type ProductEventName =
  | "room_created"
  | "room_link_copied"
  | "agent_invite_copied"
  | "collaborator_joined"
  | "collaborator_edited";

export type ProductEventActorKind = "agent" | "human" | "unknown";

type ProductEventProperties = {
  actorKind?: ProductEventActorKind;
};

type ProductAnalyticsClient = Pick<PostHog, "capture">;

const PRODUCT_EVENT_NAMES = new Set<ProductEventName>([
  "room_created",
  "room_link_copied",
  "agent_invite_copied",
  "collaborator_joined",
  "collaborator_edited",
]);

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
  for (const key of ["token", "distinct_id", "$session_id", "$process_person_profile", "app_version", "actor_kind"]) {
    copyProperty(properties, event.properties, key);
  }
  return { ...event, properties } as CaptureResult;
};

export const createProductAnalytics = ({
  appVersion = "0.1.0",
  client,
}: {
  appVersion?: string;
  client?: ProductAnalyticsClient | null | Promise<ProductAnalyticsClient | null>;
} = {}) => ({
  report(name: ProductEventName, properties: ProductEventProperties = {}) {
    if (!client) return;
    const actorKind = properties.actorKind;
    const eventProperties = {
      app_version: appVersion.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32),
      ...(actorKind === "agent" || actorKind === "human" || actorKind === "unknown"
        ? { actor_kind: actorKind }
        : {}),
    };
    if ("then" in client) {
      void client.then((loadedClient) => loadedClient?.capture(name, eventProperties));
      return;
    }
    client.capture(name, eventProperties);
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
