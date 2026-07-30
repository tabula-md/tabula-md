export type WorkspaceSyntaxProfile = "gfm" | "mdx";

export type WorkspaceConventionProfile = "obsidian" | "openwiki";

export type WorkspaceSchemaProfile = {
  id: "okf";
  version: string;
};

export type WorkspaceWorkflowProfile = "llm-wiki";

export type WorkspaceAgentInstructionProfile =
  | "agents-md"
  | "claude-md"
  | "agent-skills";

export type WorkspaceDeliveryProfile = "llms-txt";

export type WorkspaceProfile = {
  syntaxes: readonly WorkspaceSyntaxProfile[];
  conventions: readonly WorkspaceConventionProfile[];
  schemas: readonly WorkspaceSchemaProfile[];
  workflows: readonly WorkspaceWorkflowProfile[];
  agentInstructions: readonly WorkspaceAgentInstructionProfile[];
  deliveries: readonly WorkspaceDeliveryProfile[];
};

export const createEmptyWorkspaceProfile = (): WorkspaceProfile => ({
  syntaxes: [],
  conventions: [],
  schemas: [],
  workflows: [],
  agentInstructions: [],
  deliveries: [],
});

export const isOrdinaryMarkdownProfile = (profile: WorkspaceProfile) =>
  profile.syntaxes.length === 1 &&
  profile.syntaxes[0] === "gfm" &&
  profile.conventions.length === 0 &&
  profile.schemas.length === 0 &&
  profile.workflows.length === 0 &&
  profile.agentInstructions.length === 0 &&
  profile.deliveries.length === 0;
