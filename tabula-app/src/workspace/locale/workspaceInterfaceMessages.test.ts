import { describe, expect, it } from "vitest";
import { workspaceInterfaceMessages } from "./workspaceInterfaceMessages";

describe("workspace interface locale schema", () => {
  it("keeps every language aligned with the English key schema", () => {
    const englishKeys = Object.keys(workspaceInterfaceMessages.en).sort();

    Object.values(workspaceInterfaceMessages).forEach((messages) => {
      expect(Object.keys(messages).sort()).toEqual(englishKeys);
    });
  });

  it("uses the product name rather than the domain in interface copy", () => {
    Object.values(workspaceInterfaceMessages).forEach((messages) => {
      Object.values(messages).forEach((message) => {
        expect(message).not.toContain("Tabula.md");
      });
    });
  });
});
