import { describe, expect, it } from "vitest";
import { getWorkspaceContextSummary } from "./workspaceContextSummary";
import { getWorkspaceStatusIndicator } from "./workspaceStatusIndicator";

describe("workspace status indicator", () => {
  it("keeps a browser-only saved workspace quiet", () => {
    const summary = getWorkspaceContextSummary("en", {
      authority: { kind: "browser" },
      browserPersistence: { state: "saved" },
      folderBinding: null,
      collaboration: null,
    });

    expect(getWorkspaceStatusIndicator(summary)).toEqual({
      kind: "browser",
      label: "This browser",
      description: "Saved automatically here. Not connected to a local folder.",
      tone: "quiet",
    });
  });

  it("surfaces a folder conflict over a healthy live room", () => {
    const summary = getWorkspaceContextSummary("en", {
      authority: { kind: "live" },
      browserPersistence: { state: "suspended" },
      folderBinding: {
        label: "Handbook",
        writeMode: "automatic",
        status: "conflict",
      },
      collaboration: {
        connectionStatus: "connected",
        durability: "clean",
        recoveryMode: "durable",
      },
    });

    expect(getWorkspaceStatusIndicator(summary)).toMatchObject({
      kind: "folder",
      label: "Saving is paused until the folder conflict is resolved.",
      tone: "attention",
    });
  });

  it("shows active persistence work before a steady folder binding", () => {
    const summary = getWorkspaceContextSummary("en", {
      authority: { kind: "folder" },
      browserPersistence: { state: "saving" },
      folderBinding: {
        label: "Handbook",
        writeMode: "manual",
        status: "ready",
      },
      collaboration: null,
    });

    expect(getWorkspaceStatusIndicator(summary)).toMatchObject({
      kind: "browser",
      label: "Saving a recovery copy in this browser…",
      tone: "working",
    });
  });

  it("keeps a failed folder save visible after the toast disappears", () => {
    const summary = getWorkspaceContextSummary("en", {
      authority: { kind: "folder" },
      browserPersistence: { state: "saved" },
      folderBinding: {
        label: "Handbook",
        writeMode: "manual",
        status: "error",
      },
      collaboration: null,
    });

    expect(getWorkspaceStatusIndicator(summary)).toMatchObject({
      kind: "folder",
      label: "Couldn’t save to this folder. Your changes remain in this browser.",
      tone: "attention",
    });
  });
});
