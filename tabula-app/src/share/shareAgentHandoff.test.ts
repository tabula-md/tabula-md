import { describe, expect, it } from "vitest";
import {
  buildAgentInvite,
  TABULA_AGENT_INSTALL_URL,
  TABULA_MCP_SETUP_URL,
} from "./shareAgentHandoff";

describe("agent handoff", () => {
  it("builds a minimal room invite without task or protocol controls", () => {
    const invite = buildAgentInvite("https://tabula.test/#room=room-1,secret");

    expect(invite).toContain("Use your Tabula tools to join this room");
    expect(invite).toContain("following every step at");
    expect(invite).toContain(TABULA_AGENT_INSTALL_URL);
    expect(invite).toContain("paste this invite again");
    expect(invite).toContain("Keep the room URL private");
    expect(invite).toContain("https://tabula.test/#room=room-1,secret");
    expect(invite).not.toMatch(/Task:|Scope:|Target document:|Yjs|binary protocol|Markdown/);
  });

  it("keeps human setup docs separate from the agent setup runbook", () => {
    expect(TABULA_AGENT_INSTALL_URL).toBe("https://tabula.md/agent-install.txt");
    expect(TABULA_MCP_SETUP_URL).toBe("https://github.com/tabula-md/tabula-mcp#install");
  });
});
