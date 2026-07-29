import { describe, expect, it } from "vitest";
import { workspaceInterfaceMessages } from "./workspaceInterfaceMessages";
import { enWorkspaceInterfaceMessageDomains } from "./workspaceInterfaceMessages/en";

describe("workspace interface locale schema", () => {
  it("keeps every language aligned with the English key schema", () => {
    const englishKeys = Object.keys(workspaceInterfaceMessages.en).sort();

    Object.values(workspaceInterfaceMessages).forEach((messages) => {
      expect(Object.keys(messages).sort()).toEqual(englishKeys);
    });
  });

  it("assigns every interface key to exactly one feature domain", () => {
    const englishKeys = Object.keys(workspaceInterfaceMessages.en).sort();
    const domainKeys = Object.values(enWorkspaceInterfaceMessageDomains)
      .flatMap((messages) => Object.keys(messages));

    expect([...new Set(domainKeys)].sort()).toEqual(englishKeys);
    expect(domainKeys).toHaveLength(englishKeys.length);
  });

  it("uses the product name rather than the domain in interface copy", () => {
    Object.values(workspaceInterfaceMessages).forEach((messages) => {
      Object.values(messages).forEach((message) => {
        expect(message).not.toContain("Tabula.md");
      });
    });
  });
});
