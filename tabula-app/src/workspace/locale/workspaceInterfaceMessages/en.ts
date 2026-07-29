import { enCommentsMessages } from "./en/comments";
import { enFilesMessages } from "./en/files";
import { enGraphMessages } from "./en/graph";
import { enLinksMessages } from "./en/links";
import { enOutlineMessages } from "./en/outline";
import { enPanelsMessages } from "./en/panels";
import { enSearchMessages } from "./en/search";
import { enTabsMessages } from "./en/tabs";

export const enWorkspaceInterfaceMessageDomains = {
  tabs: enTabsMessages,
  panels: enPanelsMessages,
  search: enSearchMessages,
  files: enFilesMessages,
  outline: enOutlineMessages,
  links: enLinksMessages,
  graph: enGraphMessages,
  comments: enCommentsMessages,
} as const;

export const enWorkspaceInterfaceMessages = {
  ...enTabsMessages,
  ...enPanelsMessages,
  ...enSearchMessages,
  ...enFilesMessages,
  ...enOutlineMessages,
  ...enLinksMessages,
  ...enGraphMessages,
  ...enCommentsMessages,
} as const;
