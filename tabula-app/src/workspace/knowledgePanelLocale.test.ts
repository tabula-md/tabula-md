import { describe, expect, it } from "vitest";
import { getKnowledgePanelCopy } from "./knowledgePanelLocale";

describe("knowledge panel copy", () => {
  it("describes review metadata as a record rather than a guarantee", () => {
    expect(getKnowledgePanelCopy("en").humanReviewed).toBe(
      "Human review recorded",
    );
    expect(getKnowledgePanelCopy("ko").humanReviewed).toBe(
      "사람 검토 기록 있음",
    );
  });

  it("limits an empty issue result to what Tabula inspected", () => {
    expect(getKnowledgePanelCopy("en").noIssues).toBe(
      "No issues detected by Tabula for this document.",
    );
    expect(getKnowledgePanelCopy("ko").noIssues).toBe(
      "Tabula 검사에서 이 문서의 문제가 발견되지 않았습니다.",
    );
  });
});
