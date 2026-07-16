import { describe, expect, it } from "vitest";
import {
  buildAgentContextPrompt,
  buildLiveAgentRequest,
  getAgentClientSetup,
  TABULA_HOSTED_MCP_URL,
} from "./shareAgentHandoff";
import type { WorkspaceFile } from "./workspaceStorage";

const file = (id: string, title: string, text: string): WorkspaceFile => ({
  id,
  title,
  text,
  viewMode: "edit",
  readingWidth: "wide",
  lineWrapping: true,
  lineNumbers: true,
});

describe("agent handoff", () => {
  it("uses the hosted connector for supported hosted clients", () => {
    expect(getAgentClientSetup("claude")).toEqual({
      trust: "hosted",
      value: TABULA_HOSTED_MCP_URL,
    });
    expect(getAgentClientSetup("chatgpt")).toEqual({
      trust: "hosted",
      value: TABULA_HOSTED_MCP_URL,
    });
  });

  it("provides write-enabled local setup for local agent clients", () => {
    expect(getAgentClientSetup("claude-code").value).toContain(
      "claude mcp add tabula -- npx -y @tabula-md/mcp@latest --enable-write",
    );
    expect(getAgentClientSetup("codex").value).toContain(
      "codex mcp add tabula -- npx -y @tabula-md/mcp@latest --enable-write",
    );
  });

  it("builds a tool-oriented live request without stale Markdown or protocol internals", () => {
    const request = buildLiveAgentRequest({
      activeFile: file("readme", "README.md", "private body"),
      instruction: "Review this and add a conclusion.",
      liveRoomUrl: "https://tabula.test/#room=room-1,secret",
      scope: "file",
    });

    expect(request).toContain("Call tabula_read_me first");
    expect(request).toContain("Call tabula_connect_room");
    expect(request).toContain("tabula_apply_workspace_changes");
    expect(request).toContain("Task: Review this and add a conclusion.");
    expect(request).toContain("Target document: README.md (readme)");
    expect(request).toContain("Room URL: https://tabula.test/#room=room-1,secret");
    expect(request).not.toMatch(/private body|Yjs|Awareness|binary protocol|CRDT schema/);
  });

  it("builds a clearly non-live Markdown context fallback", () => {
    const prompt = buildAgentContextPrompt({
      activeFile: file("readme", "README.md", "# README\n\nStart here."),
      files: [
        file("readme", "README.md", "# README\n\nStart here."),
        file("design", "DESIGN.md", "# Design"),
      ],
      instruction: "Summarize this.",
      scope: "file",
    });

    expect(prompt).toContain("Task: Summarize this.");
    expect(prompt).toContain("## README.md");
    expect(prompt).toContain("Start here.");
    expect(prompt).toContain("will not sync back");
    expect(prompt).not.toContain("DESIGN.md");
    expect(prompt).not.toContain("Room URL:");
  });
});
