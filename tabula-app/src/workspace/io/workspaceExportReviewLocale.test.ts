import { describe, expect, it } from "vitest";
import { getWorkspaceExportReviewCopy } from "./workspaceExportReviewLocale";

describe("workspace export review copy", () => {
  it("keeps export choices explicit in Korean", () => {
    const copy = getWorkspaceExportReviewCopy("ko");
    expect(copy.reviewIssues).toBe("문제 검토");
    expect(copy.exportAnyway).toBe("그대로 내보내기");
  });

  it("provides dedicated copy for every supported language", () => {
    const languages = ["en", "ko", "ja", "zh", "es", "fr", "de"] as const;
    expect(new Set(
      languages.map((language) => getWorkspaceExportReviewCopy(language).title),
    ).size).toBe(7);
  });
});
