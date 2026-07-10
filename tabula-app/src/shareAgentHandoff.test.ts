import { describe, expect, it } from "vitest";
import { buildLocalAgentPrompt } from "./shareAgentHandoff";
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

describe("buildLocalAgentPrompt", () => {
  it("builds current file handoff context", () => {
    const prompt = buildLocalAgentPrompt({
      activeFile: file("readme", "README", "# README\n\nStart here."),
      files: [file("other", "Other", "Ignore me.")],
      instruction: "Continue this.",
      scope: "file",
    });

    expect(prompt).toContain("Task: Continue this.");
    expect(prompt).toContain("Scope: current document");
    expect(prompt).toContain("Active document: README (readme)");
    expect(prompt).toContain("## README");
    expect(prompt).not.toContain("Other");
  });

  it("builds project handoff context", () => {
    const prompt = buildLocalAgentPrompt({
      activeFile: file("readme", "README", "# README"),
      files: [
        file("readme", "README", "# README"),
        file("design", "DESIGN", "# Design"),
      ],
      instruction: "",
      scope: "project",
    });

    expect(prompt).toContain("Task: Help me continue from this context.");
    expect(prompt).toContain("Scope: current workspace");
    expect(prompt).toContain("## README");
    expect(prompt).toContain("## DESIGN");
  });

  it("adds live room instructions only when a room URL is explicitly provided", () => {
    const prompt = buildLocalAgentPrompt({
      activeFile: file("readme", "README", "# README"),
      files: [file("readme", "README", "# README")],
      instruction: "",
      liveRoomUrl: "https://tabula.test/#room=room-1&key=secret",
      scope: "file",
    });

    expect(prompt).toContain("Join this Tabula.md room as an agent actor.");
    expect(prompt).toContain("Participate as a normal room actor.");
    expect(prompt).toContain("Use Tabula.md workspace CRDT schema and binary room protocol v2.");
    expect(prompt).toContain("edit the shared Yjs workspace directly");
    expect(prompt).toContain("Room URL: https://tabula.test/#room=room-1&key=secret");
  });
});
