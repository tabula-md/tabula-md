import type { enWorkspaceInterfaceMessages } from "./workspaceInterfaceMessages/en";

export type WorkspaceInterfaceMessages = {
  [Key in keyof typeof enWorkspaceInterfaceMessages]: string;
};
