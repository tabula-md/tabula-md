import { describe, expect, it, vi } from "vitest";
import type { CaptureResult } from "posthog-js";
import {
  createProductAnalytics,
  deriveCollaborationId,
  initializeProductAnalytics,
  normalizeAcquisitionSource,
  sanitizePostHogProductEvent,
} from "./productAnalytics";

describe("product analytics", () => {
  it("is disabled when no hosted PostHog project is configured", async () => {
    await expect(initializeProductAnalytics(null)).resolves.toBeNull();
    const capture = vi.fn();
    createProductAnalytics().report("room_created");
    expect(capture).not.toHaveBeenCalled();
  });

  it("captures only the typed event properties", async () => {
    const capture = vi.fn();
    const analytics = createProductAnalytics({
      appVersion: "0.1.0\nignored",
      acquisitionSource: "HackerNews",
      client: { capture },
    });

    analytics.report("collaborator_edited", { actorKind: "agent", roomId: "public-room-id" });
    await vi.waitFor(() => expect(capture).toHaveBeenCalledOnce());
    const collaborationId = await deriveCollaborationId("public-room-id");
    expect(capture).toHaveBeenCalledWith("collaborator_edited", {
      app_version: "0.1.0ignored",
      acquisition_source: "hackernews",
      actor_kind: "agent",
      collaboration_id: collaborationId,
      is_internal: false,
    });
  });

  it("captures content-free agent handoff dimensions", async () => {
    const capture = vi.fn();
    const analytics = createProductAnalytics({ client: { capture } });

    analytics.report("agent_request_copied", {
      agentClient: "claude",
      handoffMode: "live",
      roomId: "public-room-id",
    });

    await vi.waitFor(() => expect(capture).toHaveBeenCalledOnce());
    expect(capture).toHaveBeenCalledWith("agent_request_copied", expect.objectContaining({
      agent_client: "claude",
      handoff_mode: "live",
    }));
  });

  it("accepts only short content-free acquisition source labels", () => {
    expect(normalizeAcquisitionSource(" ProductHunt ")).toBe("producthunt");
    expect(normalizeAcquisitionSource("hn-launch_1")).toBe("hn-launch_1");
    expect(normalizeAcquisitionSource("https://example.com/private?q=secret")).toBeNull();
    expect(normalizeAcquisitionSource("a".repeat(33))).toBeNull();
  });

  it("derives a stable opaque collaboration id without exposing the room id", async () => {
    const first = await deriveCollaborationId("public-room-id");
    const second = await deriveCollaborationId("public-room-id");
    const different = await deriveCollaborationId("another-room-id");

    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).toMatch(/^collab_[A-Za-z0-9_-]{22}$/);
    expect(first).not.toContain("public-room-id");
  });

  it("drops non-product events and strips URL, document, DOM, and referrer properties", () => {
    const unsafeProperties = {
      token: "phc_test",
      distinct_id: "ephemeral-session",
      $session_id: "session-id",
      $process_person_profile: false,
      app_version: "0.1.0",
      agent_client: "claude",
      actor_kind: "agent",
      collaboration_id: "collab_safe",
      handoff_mode: "live",
      is_internal: false,
      acquisition_source: "hn",
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
      event: "agent_request_copied",
      properties: unsafeProperties,
    } as CaptureResult);
    const serialized = JSON.stringify(sanitized);

    expect(sanitized?.properties).toEqual({
      token: "phc_test",
      distinct_id: "ephemeral-session",
      $session_id: "session-id",
      $process_person_profile: false,
      app_version: "0.1.0",
      agent_client: "claude",
      actor_kind: "agent",
      collaboration_id: "collab_safe",
      handoff_mode: "live",
      is_internal: false,
      acquisition_source: "hn",
    });
    expect(serialized).not.toMatch(/SECRET_KEY|roomId|private document|private prompt|current_url|referrer|elements/i);
    expect(sanitizePostHogProductEvent({
      uuid: "pageview-uuid",
      event: "$pageview",
      properties: unsafeProperties,
    } as CaptureResult)).toBeNull();
  });
});
