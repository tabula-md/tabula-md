import { describe, expect, it, vi } from "vitest";
import type { CaptureResult } from "posthog-js";
import {
  createProductAnalytics,
  deriveCollaborationId,
  initializeProductAnalytics,
  normalizeAcquisitionSource,
  recordHandoffCompletion,
  sanitizePostHogProductEvent,
} from "./productAnalytics";

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe("product analytics", () => {
  it("is disabled when no hosted PostHog project is configured", async () => {
    await expect(initializeProductAnalytics(null)).resolves.toBeNull();
    const capture = vi.fn();
    createProductAnalytics().report("room_created");
    expect(capture).not.toHaveBeenCalled();

    const storage = createMemoryStorage();
    createProductAnalytics({
      client: Promise.resolve(null),
      handoffStorage: storage,
    }).reportHandoffCompleted({ roomId: "private-room", actorKind: "human" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(storage.getItem("tabula.analytics.handoff-history")).toBeNull();
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

  it("captures a content-free agent invite conversion", async () => {
    const capture = vi.fn();
    const analytics = createProductAnalytics({ client: { capture } });

    analytics.report("agent_invite_copied", { roomId: "public-room-id" });

    await vi.waitFor(() => expect(capture).toHaveBeenCalledOnce());
    expect(capture).toHaveBeenCalledWith(
      "agent_invite_copied",
      expect.objectContaining({ collaboration_id: expect.stringMatching(/^collab_/) }),
    );
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

  it("records one handoff per room and one repeat after 24 hours", async () => {
    const storage = createMemoryStorage();
    const firstCollaborationId = await deriveCollaborationId("room-first");
    const secondCollaborationId = await deriveCollaborationId("room-second");
    const thirdCollaborationId = await deriveCollaborationId("room-third");
    const startedAt = Date.UTC(2026, 6, 20, 9);

    expect(recordHandoffCompletion({
      collaborationId: firstCollaborationId!,
      now: startedAt,
      storage,
    })).toEqual({ firstCompletion: true, repeatHandoff: false });
    expect(recordHandoffCompletion({
      collaborationId: firstCollaborationId!,
      now: startedAt + 1_000,
      storage,
    })).toEqual({ firstCompletion: false, repeatHandoff: false });
    expect(recordHandoffCompletion({
      collaborationId: secondCollaborationId!,
      now: startedAt + 23 * 60 * 60 * 1_000,
      storage,
    })).toEqual({ firstCompletion: true, repeatHandoff: false });
    expect(recordHandoffCompletion({
      collaborationId: thirdCollaborationId!,
      now: startedAt + 25 * 60 * 60 * 1_000,
      storage,
    })).toEqual({ firstCompletion: true, repeatHandoff: true });
  });

  it("captures explicit handoff and repeat events without a persistent person id", async () => {
    const capture = vi.fn();
    const storage = createMemoryStorage();
    let now = Date.UTC(2026, 6, 20, 9);
    const analytics = createProductAnalytics({
      client: { capture },
      handoffStorage: storage,
      now: () => now,
    });

    analytics.reportHandoffCompleted({ roomId: "room-first", actorKind: "human" });
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    analytics.reportHandoffCompleted({ roomId: "room-first", actorKind: "human" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(capture).toHaveBeenCalledTimes(1);

    now += 25 * 60 * 60 * 1_000;
    analytics.reportHandoffCompleted({ roomId: "room-second", actorKind: "agent" });
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(3));

    expect(capture.mock.calls.map(([event]) => event)).toEqual([
      "handoff_completed",
      "handoff_completed",
      "repeat_handoff",
    ]);
    expect(capture).toHaveBeenLastCalledWith(
      "repeat_handoff",
      expect.objectContaining({
        actor_kind: "agent",
        collaboration_id: expect.stringMatching(/^collab_/),
      }),
    );
  });

  it("drops non-product events and strips URL, document, DOM, and referrer properties", () => {
    const unsafeProperties = {
      token: "phc_test",
      distinct_id: "ephemeral-session",
      $session_id: "session-id",
      $process_person_profile: false,
      app_version: "0.1.0",
      actor_kind: "agent",
      collaboration_id: "collab_safe",
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
      event: "handoff_completed",
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
      collaboration_id: "collab_safe",
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
