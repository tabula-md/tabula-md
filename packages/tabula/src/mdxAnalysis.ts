import {
  analyzeWorkspaceDocument,
  type DocumentAnalysis,
  type WorkspaceSourceDocument,
} from "./workspaceKnowledgeIndex";
import {
  maskMdxSyntax,
  scanMdxSourceRanges,
  type MdxSourceRange,
} from "./mdxSourceSyntax";

export type MdxAnalysisDiagnosticCode =
  | "mdx-expression-not-evaluated"
  | "mdx-import-not-loaded"
  | "mdx-export-not-evaluated"
  | "unknown-mdx-component";

export type MdxAnalysisDiagnostic = {
  code: MdxAnalysisDiagnosticCode;
  from: number;
  to: number;
  componentName?: string;
};

export type MdxSourceAnalysis = {
  document: DocumentAnalysis;
  ranges: readonly MdxSourceRange[];
  diagnostics: readonly MdxAnalysisDiagnostic[];
};

export const analyzeMdxSource = (
  document: WorkspaceSourceDocument,
  options: {
    registeredComponents?: readonly string[];
  } = {},
): MdxSourceAnalysis => {
  const ranges = scanMdxSourceRanges(
    document.markdown,
    options.registeredComponents,
  );
  const diagnostics: MdxAnalysisDiagnostic[] = [];
  for (const range of ranges) {
    if (range.kind === "esm-import") {
      diagnostics.push({ code: "mdx-import-not-loaded", from: range.from, to: range.to });
    } else if (range.kind === "esm-export") {
      diagnostics.push({ code: "mdx-export-not-evaluated", from: range.from, to: range.to });
    } else if (range.kind === "expression") {
      diagnostics.push({ code: "mdx-expression-not-evaluated", from: range.from, to: range.to });
    } else if (range.kind === "jsx-component" && !range.registered) {
      diagnostics.push({
        code: "unknown-mdx-component",
        componentName: range.name,
        from: range.from,
        to: range.to,
      });
    }
  }

  return {
    document: analyzeWorkspaceDocument({
      ...document,
      markdown: maskMdxSyntax(document.markdown, ranges),
    }),
    ranges,
    diagnostics,
  };
};
