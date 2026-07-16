export const TABULA_MCP_SETUP_URL =
  "https://github.com/tabula-md/tabula-mcp#quick-start";

export const buildAgentInvite = (liveRoomUrl: string) => [
  "Use your Tabula tools to join this room and work with me.",
  "Keep the room URL private.",
  "If Tabula tools are unavailable, tell me to set up Tabula MCP.",
  "",
  liveRoomUrl,
].join("\n");
