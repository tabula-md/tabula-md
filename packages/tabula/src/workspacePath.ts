export const WORKSPACE_PATH_SEGMENT_MAX_LENGTH = 255;

export type WorkspacePathSegmentIssue =
  | "empty"
  | "reserved"
  | "separator"
  | "control-character"
  | "too-long";

export const getWorkspacePathSegmentIssue = (value: string): WorkspacePathSegmentIssue | null => {
  if (!value || !value.trim()) return "empty";
  if (value === "." || value === "..") return "reserved";
  if (/[/\\]/.test(value)) return "separator";
  if (value.includes("\0") || value.includes("\r") || value.includes("\n")) {
    return "control-character";
  }
  if (value.length > WORKSPACE_PATH_SEGMENT_MAX_LENGTH) return "too-long";
  return null;
};

export const isWorkspacePathSegment = (value: string) =>
  getWorkspacePathSegmentIssue(value) === null;
