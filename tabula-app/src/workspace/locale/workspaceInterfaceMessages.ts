import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type { WorkspaceInterfaceMessages } from "./workspaceInterfaceSchema";
import { enWorkspaceInterfaceMessages } from "./workspaceInterfaceMessages/en";
import { koWorkspaceInterfaceMessages } from "./workspaceInterfaceMessages/ko";
import { jaWorkspaceInterfaceMessages } from "./workspaceInterfaceMessages/ja";
import { zhWorkspaceInterfaceMessages } from "./workspaceInterfaceMessages/zh";
import { esWorkspaceInterfaceMessages } from "./workspaceInterfaceMessages/es";
import { frWorkspaceInterfaceMessages } from "./workspaceInterfaceMessages/fr";
import { deWorkspaceInterfaceMessages } from "./workspaceInterfaceMessages/de";

export const workspaceInterfaceMessages: Record<
  WorkspaceLanguage,
  WorkspaceInterfaceMessages
> = {
  en: enWorkspaceInterfaceMessages,
  ko: koWorkspaceInterfaceMessages,
  ja: jaWorkspaceInterfaceMessages,
  zh: zhWorkspaceInterfaceMessages,
  es: esWorkspaceInterfaceMessages,
  fr: frWorkspaceInterfaceMessages,
  de: deWorkspaceInterfaceMessages,
};
