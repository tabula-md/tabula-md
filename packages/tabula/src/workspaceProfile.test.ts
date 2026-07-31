import { describe, expect, it } from "vitest";
import {
  createEmptyWorkspaceProfile,
  isOrdinaryMarkdownProfile,
} from "./workspaceProfile";

describe("workspace profile", () => {
  it("treats ordinary GFM as a valid profile rather than a missing profile", () => {
    expect(isOrdinaryMarkdownProfile({
      ...createEmptyWorkspaceProfile(),
      syntaxes: ["gfm"],
    })).toBe(true);
  });

  it("allows independent profile dimensions to coexist", () => {
    expect(isOrdinaryMarkdownProfile({
      syntaxes: ["gfm", "mdx"],
      conventions: ["obsidian", "openwiki"],
      schemas: [{ id: "okf", version: "0.1" }],
      workflows: ["llm-wiki"],
      agentInstructions: ["agents-md", "agent-skills"],
      deliveries: ["llms-txt"],
    })).toBe(false);
  });
});
