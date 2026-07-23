import { describe, expect, it } from "vitest";
import type {
  OkfCompatibilityIssue,
  OkfCompatibilityIssueCode,
} from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";
import { getKnowledgeCompatibilityCopy } from "./knowledgeCompatibilityLocale";

const languages: WorkspaceLanguage[] = ["en", "ko", "ja", "zh", "es", "fr", "de"];
const issueCodes: OkfCompatibilityIssueCode[] = [
  "concept_frontmatter_missing",
  "concept_frontmatter_invalid",
  "concept_type_missing",
  "concept_type_invalid",
  "reserved_frontmatter_invalid",
  "reserved_frontmatter_not_allowed",
  "root_index_version_invalid",
  "root_index_extra_metadata",
  "unsupported_okf_version",
  "index_structure_invalid",
  "log_structure_invalid",
  "log_date_invalid",
  "log_dates_out_of_order",
  "nonstandard_markdown_extension",
  "wikilink_syntax",
];

describe("knowledge compatibility copy", () => {
  it("provides resolved status and issue instructions in every workspace language", () => {
    for (const language of languages) {
      const copy = getKnowledgeCompatibilityCopy(language);
      expect(copy.compatible("0.1")).toContain("0.1");
      expect(copy.requiredChanges(1)).toContain("1");
      expect(copy.portabilityWarnings(2)).toContain("2");
      expect(copy.conceptTypeLabel.trim()).not.toBe("");
      expect(copy.addFrontmatterAndType.trim()).not.toBe("");
      expect(copy.setConceptType.trim()).not.toBe("");

      for (const code of issueCodes) {
        const issue: OkfCompatibilityIssue = {
          code,
          severity: "error",
          documentId: "document",
          path: "concept.md",
          value: "sample",
        };
        expect(copy.issue(issue)).not.toContain("{{");
        expect(copy.issue(issue).trim()).not.toBe("");
      }
    }
  });
});
