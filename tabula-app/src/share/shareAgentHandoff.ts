export const TABULA_MCP_SETUP_URL = "https://github.com/tabula-md/tabula-mcp#install";
export const TABULA_AGENT_INSTALL_URL = "https://tabula.md/agent-install.txt";

export const buildAgentInvite = (liveRoomUrl: string) => [
  "Use your Tabula tools to join this room and work with me.",
  "If Tabula tools are unavailable, set up Tabula MCP by following every step at:",
  TABULA_AGENT_INSTALL_URL,
  "Ask before changing client settings. If a restart is required, tell me to restart the client and paste this invite again.",
  "Keep the room URL private.",
  "",
  liveRoomUrl,
].join("\n");
