import { describe, expect, it } from "vitest";
import {
  getActiveWorkspaceStatus,
  getWorkspaceFileSearchText,
  getWorkspaceFileStatus,
  getWorkspaceStatusLabel,
  isUsableWorkspaceRoomFile,
  type WorkspaceViewFile,
} from "./workspaceViewModel";

const validRoomShareUrl =
  "https://tabula.md/#room=abcdefghijklmnopqrstuA,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const file = (overrides: Partial<WorkspaceViewFile> = {}): WorkspaceViewFile => ({
  id: "file-1",
  title: "README.md",
  text: "---\ntitle: Product Requirements\n---\n\n# Body",
  ...overrides,
});

describe("workspace view model", () => {
  it("labels connection states for user-facing chrome", () => {
    expect(getWorkspaceStatusLabel("connected")).toBe("Live session");
    expect(getWorkspaceStatusLabel("idle")).toBe("Local draft");
    expect(getActiveWorkspaceStatus({ isLive: false, connectionStatus: "connected" })).toBe("idle");
    expect(getActiveWorkspaceStatus({ isLive: true, connectionStatus: "connected" })).toBe("connected");
  });

  it("uses active connection status for the active file", () => {
    expect(
      getWorkspaceFileStatus({
        file: file(),
        activeFileId: "file-1",
        activeConnectionStatus: "connected",
      }),
    ).toBe("connected");
  });

  it("keeps non-room files local and room files offline by default", () => {
    expect(
      getWorkspaceFileStatus({
        file: file({ id: "local" }),
        activeFileId: "other",
        activeConnectionStatus: "connected",
      }),
    ).toBe("idle");

    expect(
      getWorkspaceFileStatus({
        file: file({
          id: "room",
          roomId: "abcdefghijklmnopqrstuA",
          shareUrl: validRoomShareUrl,
        }),
        activeFileId: "other",
        activeConnectionStatus: "connected",
      }),
    ).toBe("offline");
  });

  it("rejects broken room metadata instead of showing live state", () => {
    const brokenFile = file({
      id: "room",
      roomId: "abcdefghijklmnopqrstuA",
      shareUrl: "https://tabula.md/#room=other,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      connectionStatus: "connected",
    });

    expect(isUsableWorkspaceRoomFile(brokenFile)).toBe(false);
    expect(
      getWorkspaceFileStatus({
        file: brokenFile,
        activeFileId: "other",
        activeConnectionStatus: "connected",
      }),
    ).toBe("idle");
  });

  it("indexes file name and frontmatter title for file search", () => {
    expect(getWorkspaceFileSearchText(file())).toBe("README.md Product Requirements");
  });
});
