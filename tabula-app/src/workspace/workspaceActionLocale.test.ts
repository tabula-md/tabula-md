import { describe, expect, it } from "vitest";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";
import { getWorkspaceActionCopy } from "./workspaceActionLocale";

const translatedLanguages: WorkspaceLanguage[] = ["ko", "ja", "zh", "es", "fr", "de"];

describe("workspace action locale", () => {
  it("does not fall back to English for operational feedback", () => {
    const english = getWorkspaceActionCopy("en");
    const stringKeys = Object.entries(english)
      .filter((entry): entry is [keyof typeof english, string] => typeof entry[1] === "string")
      .map(([key]) => key);

    for (const language of translatedLanguages) {
      const translated = getWorkspaceActionCopy(language);
      for (const key of stringKeys) {
        expect(translated[key], `${language}.${key}`).not.toBe(english[key]);
      }
      expect(translated.documentAdded("Plan.md")).not.toBe(english.documentAdded("Plan.md"));
      expect(translated.documentRenamed("Old.md", "New.md")).not.toBe(
        english.documentRenamed("Old.md", "New.md"),
      );
    }
  });
});
