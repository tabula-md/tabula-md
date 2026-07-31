import { describe, expect, it } from "vitest";
import type {
  OkfCompatibilityIssue,
  OkfCompatibilityIssueCode,
  WorkspaceKnowledgeHealthIssue,
  WorkspaceKnowledgeHealthIssueCode,
} from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";
import { getKnowledgeCompatibilityCopy } from "./knowledgeCompatibilityLocale";

const languages: WorkspaceLanguage[] = ["en", "ko", "ja", "zh", "es", "fr", "de"];
const issueCodes: OkfCompatibilityIssueCode[] = [
  "okf_02_attester_invalid",
  "okf_02_attester_resource_missing",
  "okf_02_computation_missing",
  "okf_02_computation_resource_missing",
  "okf_02_executor_invalid",
  "okf_02_executor_resource_missing",
  "okf_02_parameter_duplicate",
  "okf_02_parameters_invalid",
  "okf_02_receipt_empty",
  "okf_02_runtime_missing",
  "okf_02_runtime_unsupported",
  "okf_02_source_author_invalid",
  "okf_02_stale_computation_in_use",
  "okf_02_usage_window_invalid",
  "okf_02_usage_window_missing",
  "concept_frontmatter_missing",
  "concept_frontmatter_invalid",
  "concept_type_missing",
  "concept_type_invalid",
  "reserved_frontmatter_invalid",
  "reserved_frontmatter_not_allowed",
  "root_index_version_invalid",
  "root_index_extra_metadata",
  "unsupported_okf_version",
  "okf_01_timestamp_invalid",
  "okf_02_actor_invalid",
  "okf_02_generated_invalid",
  "okf_02_sources_invalid",
  "okf_02_stale_after_invalid",
  "okf_02_status_invalid",
  "okf_02_verified_invalid",
  "index_structure_invalid",
  "log_structure_invalid",
  "log_date_invalid",
  "log_dates_out_of_order",
  "nonstandard_markdown_extension",
  "wikilink_syntax",
];
const healthIssueCodes: WorkspaceKnowledgeHealthIssueCode[] = [
  "stale",
  "deprecated_referenced",
  "unverified_generated",
  "verification_outdated",
  "provenance_missing",
  "orphan_concept",
  "source_reference_missing",
  "source_unused",
  "optional_metadata_invalid",
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
      expect(copy.healthTitle.trim()).not.toBe("");
      expect(copy.healthAttention(2)).toContain("2");
      expect(copy.healthNotices(3)).toContain("3");
      expect(copy.migrationTitle.trim()).not.toBe("");
      expect(copy.migrationDescription.trim()).not.toBe("");
      expect(copy.migrationChangedFiles(2)).toContain("2");
      expect(copy.migrationManualCitations(3)).toContain("3");
      expect(copy.migrationMissingProducers(4)).toContain("4");
      expect(copy.migrationDeletedFiles(0)).toContain("0");
      expect(copy.migrationDecisions(1)).toContain("1");
      expect(copy.supportCore.trim()).not.toBe("");
      expect(copy.supportAdvanced(2)).toContain("2");
      expect(copy.supportAdvancedPartial(1, "custom")).toContain("custom");
      expect(copy.llmsTitle.trim()).not.toBe("");
      expect(copy.llmsDescription.trim()).not.toBe("");
      expect(copy.llmsPrivateExcluded(2)).toContain("2");
      expect(copy.llmsIncluded(3)).toContain("3");
      expect(copy.interchangeTitle.trim()).not.toBe("");
      expect(copy.interchangeDescription.trim()).not.toBe("");
      expect(copy.interchangeMapped(2)).toContain("2");
      expect(copy.interchangeLosses(3)).toContain("3");
      expect(copy.interchangeImportMapped(4)).toContain("4");

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
      for (const code of healthIssueCodes) {
        const issue: WorkspaceKnowledgeHealthIssue = {
          code,
          severity: "attention",
          documentId: "document",
          path: "concept.md",
          value: "sample",
        };
        expect(copy.healthIssue(issue)).not.toContain("{{");
        expect(copy.healthIssue(issue).trim()).not.toBe("");
      }
    }
  });
});
