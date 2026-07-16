import { describe, expect, it } from "vitest";
import { buildAgentInvite, TABULA_MCP_SETUP_URL } from "./shareAgentHandoff";

describe("agent handoff", () => {
  it("builds a minimal room invite without task or protocol controls", () => {
    const invite = buildAgentInvite("https://tabula.test/#room=room-1,secret");

    expect(invite).toContain("Use your Tabula tools to join this room");
    expect(invite).toContain("Keep the room URL private");
    expect(invite).toContain("https://tabula.test/#room=room-1,secret");
    expect(invite).not.toMatch(/Task:|Scope:|Target document:|Yjs|binary protocol|Markdown/);
  });

  it("links one-time setup outside the invite flow", () => {
    expect(TABULA_MCP_SETUP_URL).toBe(
      "https://github.com/tabula-md/tabula-mcp#install",
    );
  });
});
