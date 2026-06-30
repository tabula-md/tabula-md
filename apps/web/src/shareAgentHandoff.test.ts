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
    expect(prompt).toContain("Scope: current file");
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
    expect(prompt).toContain("Scope: project");
    expect(prompt).toContain("## README");
    expect(prompt).toContain("## DESIGN");
  });
});
