import { describe, expect, it } from "vitest";
import {
  getActiveWorkspaceStatus,
  getWorkspaceFileSearchText,
  getWorkspaceStatusLabel,
  type WorkspaceViewFile,
} from "./workspaceViewModel";

const file = (overrides: Partial<WorkspaceViewFile> = {}): WorkspaceViewFile => ({
  id: "file-1",
  title: "README.md",
  text: "---\ntitle: Product Requirements\n---\n\n# Body",
  ...overrides,
});

describe("workspace view model", () => {
  it("labels connection states for user-facing chrome", () => {
    expect(getWorkspaceStatusLabel("connected")).toBe("Live session");
    expect(getWorkspaceStatusLabel("reconnecting")).toBe("Reconnecting");
    expect(getWorkspaceStatusLabel("suspended")).toBe("Session paused");
    expect(getWorkspaceStatusLabel("disconnected")).toBe("Disconnected");
    expect(getWorkspaceStatusLabel("failed")).toBe("Connection failed");
    expect(getWorkspaceStatusLabel("idle")).toBe("Local draft");
    expect(getActiveWorkspaceStatus({ isLive: false, connectionStatus: "connected" })).toBe("idle");
    expect(getActiveWorkspaceStatus({ isLive: true, connectionStatus: "connected" })).toBe("connected");
  });

  it("indexes file name and frontmatter title for file search", () => {
    expect(getWorkspaceFileSearchText(file())).toBe("README.md Product Requirements");
  });
});
