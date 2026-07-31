import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_PROFILE_REGISTRY,
  getKnowledgeProfileDefinition,
} from "./knowledgeProfileRegistry";

describe("knowledge profile registry", () => {
  it("gives every profile a semantic kind and explicit support levels", () => {
    expect(KNOWLEDGE_PROFILE_REGISTRY.length).toBeGreaterThan(0);
    for (const profile of KNOWLEDGE_PROFILE_REGISTRY) {
      expect(profile.kind).toMatch(
        /^(syntax|convention|schema|workflow|agent-instruction|delivery|retrieval)$/,
      );
      expect(profile.supportLevels.length).toBeGreaterThan(0);
      expect(new Set(profile.supportLevels).size).toBe(
        profile.supportLevels.length,
      );
    }
  });

  it("does not claim execution support for declarative compatibility", () => {
    expect(
      KNOWLEDGE_PROFILE_REGISTRY.filter((profile) =>
        (profile.supportLevels as readonly string[]).includes("execute")),
    ).toEqual([]);
    expect(getKnowledgeProfileDefinition("okf-0.2")?.kind).toBe("schema");
    expect(getKnowledgeProfileDefinition("llm-wiki")?.kind).toBe("workflow");
  });
});
