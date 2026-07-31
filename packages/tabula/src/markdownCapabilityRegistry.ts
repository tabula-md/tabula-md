import { scanMarkdownWikiLinks } from "./workspaceKnowledgeIndex";

export type MarkdownCapability =
  | "commonmark"
  | "gfm-table"
  | "gfm-task-list"
  | "frontmatter"
  | "footnote"
  | "math"
  | "mermaid"
  | "wikilink"
  | "embed"
  | "callout"
  | "tabs"
  | "accordion";

export type MarkdownCapabilityFamily =
  | "commonmark"
  | "gfm"
  | "extension";

export type MarkdownSurfaceSupport =
  | "rendered"
  | "source-only"
  | "unsupported";

export type MarkdownCapabilityDefinition = {
  id: MarkdownCapability;
  label: string;
  family: MarkdownCapabilityFamily;
  portable: boolean;
  visual: MarkdownSurfaceSupport;
  preview: MarkdownSurfaceSupport;
};

export type MarkdownCapabilityOccurrence = {
  capability: MarkdownCapability;
  from: number;
  to: number;
};

export type MarkdownCapabilityDiagnostic = {
  code: "extension-portability" | "source-only";
  capability: MarkdownCapability;
  from: number;
  to: number;
  severity: "info" | "warning";
};

export type MarkdownCapabilityAnalysis = {
  capabilities: readonly MarkdownCapability[];
  occurrences: readonly MarkdownCapabilityOccurrence[];
  diagnostics: readonly MarkdownCapabilityDiagnostic[];
};

export const MARKDOWN_CAPABILITY_REGISTRY = [
  { id: "commonmark", label: "CommonMark", family: "commonmark", portable: true, visual: "rendered", preview: "rendered" },
  { id: "gfm-table", label: "GFM tables", family: "gfm", portable: true, visual: "rendered", preview: "rendered" },
  { id: "gfm-task-list", label: "GFM task lists", family: "gfm", portable: true, visual: "rendered", preview: "rendered" },
  { id: "frontmatter", label: "Frontmatter", family: "extension", portable: false, visual: "rendered", preview: "rendered" },
  { id: "footnote", label: "Footnotes", family: "extension", portable: false, visual: "rendered", preview: "rendered" },
  { id: "math", label: "Math", family: "extension", portable: false, visual: "rendered", preview: "rendered" },
  { id: "mermaid", label: "Mermaid", family: "extension", portable: false, visual: "rendered", preview: "rendered" },
  { id: "wikilink", label: "Wikilinks", family: "extension", portable: false, visual: "rendered", preview: "rendered" },
  { id: "embed", label: "Embeds", family: "extension", portable: false, visual: "rendered", preview: "rendered" },
  { id: "callout", label: "Callouts", family: "extension", portable: false, visual: "rendered", preview: "rendered" },
  { id: "tabs", label: "Tabula tabs", family: "extension", portable: false, visual: "rendered", preview: "rendered" },
  { id: "accordion", label: "Tabula accordions", family: "extension", portable: false, visual: "rendered", preview: "rendered" },
] as const satisfies readonly MarkdownCapabilityDefinition[];

const definitionsById: ReadonlyMap<
  MarkdownCapability,
  MarkdownCapabilityDefinition
> = new Map(
  MARKDOWN_CAPABILITY_REGISTRY.map((definition) => [
    definition.id,
    definition,
  ]),
);

export const getMarkdownCapabilityDefinition = (
  capability: MarkdownCapability,
) => definitionsById.get(capability);

type SourceLine = {
  from: number;
  text: string;
  to: number;
  fenced: boolean;
};

const getSourceLines = (source: string) => {
  const lines: SourceLine[] = [];
  let from = 0;
  let fence: { marker: "`" | "~"; size: number } | null = null;
  for (const text of source.split("\n")) {
    const to = from + text.length;
    const fenceMatch = text.match(/^\s*(`{3,}|~{3,})/);
    const startsFence = !fence && fenceMatch;
    const endsFence = fence &&
      new RegExp(`^\\s*\\${fence.marker}{${fence.size},}\\s*$`).test(text);
    lines.push({ from, text, to, fenced: Boolean(fence) });
    if (startsFence) {
      fence = {
        marker: fenceMatch[1]![0] as "`" | "~",
        size: fenceMatch[1]!.length,
      };
    } else if (endsFence) {
      fence = null;
    }
    from = to + 1;
  }
  return lines;
};

const collectMatches = (
  source: string,
  pattern: RegExp,
  capability: MarkdownCapability,
  isIgnored: (from: number) => boolean,
) => {
  const occurrences: MarkdownCapabilityOccurrence[] = [];
  for (const match of source.matchAll(pattern)) {
    const from = match.index;
    if (typeof from !== "number" || isIgnored(from)) continue;
    occurrences.push({
      capability,
      from,
      to: from + match[0].length,
    });
  }
  return occurrences;
};

export const analyzeMarkdownCapabilities = (
  source: string,
): MarkdownCapabilityAnalysis => {
  const lines = getSourceLines(source);
  const fencedRanges = lines
    .filter((line) => line.fenced)
    .map((line) => ({ from: line.from, to: line.to }));
  const isInFence = (offset: number) => fencedRanges.some(
    (range) => offset >= range.from && offset <= range.to,
  );
  const occurrences: MarkdownCapabilityOccurrence[] = [{
    capability: "commonmark",
    from: 0,
    to: source.length,
  }];

  if (/^---\r?\n/.test(source)) {
    const close = source.slice(4).search(/\r?\n---(?:\r?\n|$)/);
    if (close >= 0) {
      occurrences.push({
        capability: "frontmatter",
        from: 0,
        to: close + 8,
      });
    }
  }

  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index]!;
    const next = lines[index + 1]!;
    if (
      !line.fenced &&
      line.text.includes("|") &&
      /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(
        next.text,
      )
    ) {
      occurrences.push({
        capability: "gfm-table",
        from: line.from,
        to: next.to,
      });
    }
  }

  occurrences.push(
    ...collectMatches(
      source,
      /^\s*[-+*]\s+\[[ xX]\]\s+/gm,
      "gfm-task-list",
      isInFence,
    ),
    ...collectMatches(
      source,
      /\[\^[^\]\r\n]+\](?::)?/g,
      "footnote",
      isInFence,
    ),
    ...collectMatches(
      source,
      /(?:\$\$[\s\S]*?\$\$|(?<!\\)\$(?!\s)[^$\r\n]+?(?<!\s)\$)/g,
      "math",
      isInFence,
    ),
    ...collectMatches(
      source,
      /^\s*>\s*\[![A-Za-z][A-Za-z0-9_-]*\].*$/gm,
      "callout",
      isInFence,
    ),
    ...collectMatches(
      source,
      /<Callout\b[\s\S]*?<\/Callout\s*>/gi,
      "callout",
      isInFence,
    ),
    ...collectMatches(
      source,
      /<Tabs\b[\s\S]*?<\/Tabs\s*>/gi,
      "tabs",
      isInFence,
    ),
    ...collectMatches(
      source,
      /<Accordion\b[\s\S]*?<\/Accordion\s*>/gi,
      "accordion",
      isInFence,
    ),
  );

  for (const line of lines) {
    if (/^\s*(`{3,}|~{3,})mermaid(?:\s|$)/i.test(line.text)) {
      occurrences.push({
        capability: "mermaid",
        from: line.from,
        to: line.to,
      });
    }
  }

  for (const link of scanMarkdownWikiLinks(source)) {
    if (isInFence(link.from)) continue;
    occurrences.push({
      capability: "wikilink",
      from: link.from,
      to: link.to,
    });
    if (link.relation === "embed") {
      occurrences.push({
        capability: "embed",
        from: link.from,
        to: link.to,
      });
    }
  }

  occurrences.sort((first, second) =>
    first.from - second.from || first.to - second.to);
  const capabilities = [
    ...new Set(occurrences.map((occurrence) => occurrence.capability)),
  ];
  const diagnostics = occurrences.flatMap(
    (occurrence): MarkdownCapabilityDiagnostic[] => {
      const definition = definitionsById.get(occurrence.capability);
      if (!definition) return [];
      if (
        definition.visual === "source-only" ||
        definition.preview === "source-only"
      ) {
        return [{
          code: "source-only",
          capability: occurrence.capability,
          from: occurrence.from,
          to: occurrence.to,
          severity: "info",
        }];
      }
      return definition.portable
        ? []
        : [{
            code: "extension-portability",
            capability: occurrence.capability,
            from: occurrence.from,
            to: occurrence.to,
            severity: "warning",
          }];
    },
  );

  return { capabilities, occurrences, diagnostics };
};
