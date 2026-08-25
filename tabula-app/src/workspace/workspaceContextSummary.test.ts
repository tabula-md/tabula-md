import { describe, expect, it } from "vitest";
import {
  getOrderedWorkspaceContextItems,
  getWorkspaceContextSummary,
  type WorkspaceContextState,
} from "./workspaceContextSummary";

const browserContext = (): WorkspaceContextState => ({
  runtime: { kind: "local" },
  browserPersistence: { state: "saved" },
  folderBinding: null,
  collaboration: null,
});

describe("workspace context summary", () => {
  it("makes a browser-only workspace's persistence boundary explicit", () => {
    expect(getWorkspaceContextSummary("en", browserContext())).toEqual({
      primary: {
        kind: "browser",
        title: "This browser",
        description: "Saved automatically here. Not connected to a local folder.",
        state: "steady",
        attention: false,
      },
      items: [{
        kind: "browser",
        title: "This browser",
        description: "Saved automatically here. Not connected to a local folder.",
        state: "steady",
        attention: false,
      }],
    });
  });

  it("keeps browser persistence and a connected folder as separate states", () => {
    const summary = getWorkspaceContextSummary("en", {
      ...browserContext(),
      folderBinding: {
        label: "Handbook",
        writeMode: "manual",
        status: "ready",
      },
    });

    expect(summary.primary).toMatchObject({
      kind: "folder",
      title: "Handbook",
      description: "Changes stay in this browser until you save them to the folder.",
    });
    expect(summary.items).toHaveLength(2);
    expect(summary.items[0]).toMatchObject({
      kind: "browser",
      description: "A recovery copy and Tabula data are saved in this browser.",
    });
  });

  it("represents a connected folder and collaboration at the same time", () => {
    const summary = getWorkspaceContextSummary("en", {
      runtime: { kind: "room" },
      browserPersistence: { state: "suspended" },
      folderBinding: {
        label: "Handbook",
        writeMode: "automatic",
        status: "suspended",
      },
      collaboration: {
        connectionStatus: "connected",
        durability: "clean",
        recoveryMode: "durable",
      },
    });

    expect(summary.primary).toMatchObject({
      kind: "collaboration",
      title: "Live collaboration",
    });
    expect(summary.items.map((item) => item.kind)).toEqual([
      "browser",
      "folder",
      "collaboration",
    ]);
    expect(summary.items[1]).toMatchObject({
      title: "Handbook",
      description: "Saving to this folder is paused.",
    });
    expect(getOrderedWorkspaceContextItems(summary).map((item) => item.kind)).toEqual([
      "collaboration",
      "browser",
      "folder",
    ]);
  });

  it("marks persistence, folder, and room failures independently", () => {
    const summary = getWorkspaceContextSummary("ko", {
      runtime: { kind: "room" },
      browserPersistence: { state: "error" },
      folderBinding: {
        writeMode: "automatic",
        status: "conflict",
      },
      collaboration: {
        connectionStatus: "failed",
        durability: "failed",
        recoveryMode: "durable",
      },
    });

    expect(summary.items).toHaveLength(3);
    expect(summary.items.every((item) => item.attention)).toBe(true);
    expect(summary.items[1]).toMatchObject({
      description: "폴더 충돌을 해결할 때까지 저장이 중지됩니다.",
    });
  });

  it("explains where offline room changes remain", () => {
    const durable = getWorkspaceContextSummary("en", {
      runtime: { kind: "room" },
      browserPersistence: { state: "suspended" },
      folderBinding: null,
      collaboration: {
        connectionStatus: "disconnected",
        durability: "clean",
        recoveryMode: "durable",
      },
    });
    const temporary = getWorkspaceContextSummary("en", {
      runtime: { kind: "room" },
      browserPersistence: { state: "suspended" },
      folderBinding: null,
      collaboration: {
        connectionStatus: "disconnected",
        durability: "unknown",
        recoveryMode: "temporary",
      },
    });

    expect(durable.primary.description).toContain("saved in this browser");
    expect(temporary.primary.description).toContain("only in this tab");
  });
});
