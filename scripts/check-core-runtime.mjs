import assert from "node:assert/strict";

const core = await import("../packages/tabula/dist/index.js");
const collaboration = await import("../packages/tabula/dist/collaboration.js");

assert.equal(core.ROOM_WIRE_PROTOCOL_VERSION, 2);
assert.equal(typeof core.createWorkspaceRoomCrdt, "function");
assert.equal(typeof core.createWorkspaceRoomSyncController, "function");
assert.equal(typeof core.encryptWorkspaceRoomCheckpoint, "function");
assert.equal(typeof core.decryptWorkspaceRoomCheckpoint, "function");
assert.equal(typeof collaboration.createWorkspaceRoomSyncController, "function");
assert.equal(typeof collaboration.encryptWorkspaceRoomCheckpoint, "function");

const actor = core.createRoomActor({
  id: "runtime-smoke-agent",
  kind: "agent",
  client: "tabula-mcp",
});
assert.deepEqual(actor.capabilities, ["presence", "read", "write"]);
