export type KnowledgeProfileKind =
  | "syntax"
  | "convention"
  | "schema"
  | "workflow"
  | "agent-instruction"
  | "delivery"
  | "retrieval";

export type KnowledgeSupportLevel =
  | "preserve"
  | "understand"
  | "edit"
  | "validate"
  | "execute";

export type KnowledgeProfileDefinition = {
  id: string;
  label: string;
  kind: KnowledgeProfileKind;
  supportLevels: readonly KnowledgeSupportLevel[];
};

export const KNOWLEDGE_PROFILE_REGISTRY = [
  {
    id: "commonmark",
    label: "CommonMark",
    kind: "syntax",
    supportLevels: ["preserve", "understand", "edit", "validate"],
  },
  {
    id: "gfm",
    label: "GitHub Flavored Markdown",
    kind: "syntax",
    supportLevels: ["preserve", "understand", "edit", "validate"],
  },
  {
    id: "mdx",
    label: "MDX",
    kind: "syntax",
    supportLevels: ["preserve"],
  },
  {
    id: "obsidian",
    label: "Obsidian",
    kind: "convention",
    supportLevels: ["preserve", "understand"],
  },
  {
    id: "openwiki",
    label: "OpenWiki",
    kind: "convention",
    supportLevels: ["preserve", "understand"],
  },
  {
    id: "okf-0.1",
    label: "Open Knowledge Format 0.1",
    kind: "schema",
    supportLevels: ["preserve", "understand", "edit", "validate"],
  },
  {
    id: "okf-0.2",
    label: "Open Knowledge Format 0.2",
    kind: "schema",
    supportLevels: ["preserve", "understand", "edit", "validate"],
  },
  {
    id: "okf-like",
    label: "OKF-like typed knowledge",
    kind: "schema",
    supportLevels: ["preserve", "understand", "edit"],
  },
  {
    id: "llm-wiki",
    label: "LLM Wiki",
    kind: "workflow",
    supportLevels: ["preserve", "understand"],
  },
  {
    id: "agents-md",
    label: "AGENTS.md",
    kind: "agent-instruction",
    supportLevels: ["preserve", "understand", "edit"],
  },
  {
    id: "claude-md",
    label: "CLAUDE.md",
    kind: "agent-instruction",
    supportLevels: ["preserve", "understand", "edit"],
  },
  {
    id: "agent-skills",
    label: "Agent Skills",
    kind: "agent-instruction",
    supportLevels: ["preserve", "understand", "edit", "validate"],
  },
  {
    id: "llms-txt",
    label: "llms.txt",
    kind: "delivery",
    supportLevels: ["preserve", "understand", "edit", "validate"],
  },
  {
    id: "graphrag",
    label: "GraphRAG",
    kind: "retrieval",
    supportLevels: ["preserve"],
  },
] as const satisfies readonly KnowledgeProfileDefinition[];

export const getKnowledgeProfileDefinition = (id: string) =>
  KNOWLEDGE_PROFILE_REGISTRY.find((profile) => profile.id === id);
