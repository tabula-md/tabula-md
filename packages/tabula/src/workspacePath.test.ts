import { describe, expect, it } from "vitest";
import {
  WORKSPACE_PATH_SEGMENT_MAX_LENGTH,
  getWorkspacePathSegmentIssue,
  isWorkspacePathSegment,
} from "./workspacePath";

describe("workspace path segments", () => {
  it("accepts exact safe names without applying filesystem-specific normalization", () => {
    expect(isWorkspacePathSegment("API?  Guide.MD")).toBe(true);
    expect(isWorkspacePathSegment(" Attention.md ")).toBe(true);
    expect(isWorkspacePathSegment("attention.md")).toBe(true);
  });

  it("rejects structural and bounded-input hazards", () => {
    expect(getWorkspacePathSegmentIssue("")).toBe("empty");
    expect(getWorkspacePathSegmentIssue("..")).toBe("reserved");
    expect(getWorkspacePathSegmentIssue("docs/Guide.md")).toBe("separator");
    expect(getWorkspacePathSegmentIssue("docs\\Guide.md")).toBe("separator");
    expect(getWorkspacePathSegmentIssue("Guide\n.md")).toBe("control-character");
    expect(getWorkspacePathSegmentIssue("x".repeat(WORKSPACE_PATH_SEGMENT_MAX_LENGTH + 1))).toBe("too-long");
  });
});
