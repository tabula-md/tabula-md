import { describe, expect, it } from "vitest";
import { getAgentHandoffCopy } from "./agentHandoffLocale";
import { WORKSPACE_LANGUAGE_OPTIONS } from "./workspaceLocale";

describe("agent handoff locale", () => {
  it("provides complete handoff copy for every supported language", () => {
    for (const { value } of WORKSPACE_LANGUAGE_OPTIONS) {
      const copy = getAgentHandoffCopy(value);
      expect(copy.title).not.toBe("");
      expect(copy.setupByClient.claude).not.toBe("");
      expect(copy.setupByClient["claude-code"]).not.toBe("");
      expect(copy.setupByClient.codex).not.toBe("");
      expect(copy.setupByClient.chatgpt).not.toBe("");
      expect(copy.setupByClient.other).not.toBe("");
      expect(copy.trustHosted).not.toBe(copy.trustLocal);
    }
  });
});
