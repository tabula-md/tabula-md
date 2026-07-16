import { describe, expect, it, vi } from "vitest";
import type { CaptureResult } from "posthog-js";
import {
  createProductAnalytics,
  initializeProductAnalytics,
  sanitizePostHogProductEvent,
} from "./productAnalytics";

describe("product analytics", () => {
  it("is disabled when no hosted PostHog project is configured", async () => {
    await expect(initializeProductAnalytics(null)).resolves.toBeNull();
    const capture = vi.fn();
    createProductAnalytics().report("room_created");
    expect(capture).not.toHaveBeenCalled();
  });

  it("captures only the typed event properties", () => {
    const capture = vi.fn();
    const analytics = createProductAnalytics({
      appVersion: "0.1.0\nignored",
      client: { capture },
    });

    analytics.report("collaborator_edited", { actorKind: "agent" });
    expect(capture).toHaveBeenCalledWith("collaborator_edited", {
      app_version: "0.1.0ignored",
      actor_kind: "agent",
    });
  });

  it("drops non-product events and strips URL, document, DOM, and referrer properties", () => {
    const unsafeProperties = {
      token: "phc_test",
      distinct_id: "ephemeral-session",
      $session_id: "session-id",
      $process_person_profile: false,
      app_version: "0.1.0",
      actor_kind: "agent",
      $current_url: "https://tabula.md/#room=roomId,SECRET_KEY",
      $pathname: "/workspace",
      $referrer: "https://example.com/private",
      $elements_chain: "button.secret",
      markdown: "private document body",
      room_id: "roomId",
      prompt: "private prompt",
    };
    const sanitized = sanitizePostHogProductEvent({
      uuid: "event-uuid",
      event: "collaborator_edited",
      properties: unsafeProperties,
    } as CaptureResult);
    const serialized = JSON.stringify(sanitized);

    expect(sanitized?.properties).toEqual({
      token: "phc_test",
      distinct_id: "ephemeral-session",
      $session_id: "session-id",
      $process_person_profile: false,
      app_version: "0.1.0",
      actor_kind: "agent",
    });
    expect(serialized).not.toMatch(/SECRET_KEY|roomId|private document|private prompt|current_url|referrer|elements/i);
    expect(sanitizePostHogProductEvent({
      uuid: "pageview-uuid",
      event: "$pageview",
      properties: unsafeProperties,
    } as CaptureResult)).toBeNull();
  });
});
