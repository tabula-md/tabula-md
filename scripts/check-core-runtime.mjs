import assert from "node:assert/strict";

const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
if (localStorageDescriptor && !("value" in localStorageDescriptor && localStorageDescriptor.value)) {
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      get length() { return values.size; },
      clear() { values.clear(); },
      getItem(key) { return values.get(String(key)) ?? null; },
      key(index) { return [...values.keys()][index] ?? null; },
      removeItem(key) { values.delete(String(key)); },
      setItem(key, value) { values.set(String(key), String(value)); },
    },
  });
}

const core = await import("../packages/tabula/dist/index.js");
const collaboration = await import("../packages/tabula/dist/collaboration.js");
const roomClient = await import("../packages/tabula/dist/roomClient.js");

assert.equal(core.ROOM_WIRE_PROTOCOL_VERSION, 2);
assert.equal(typeof core.createWorkspaceRoomCrdt, "function");
assert.equal(typeof core.createWorkspaceRoomSyncController, "function");
assert.equal(typeof core.encryptWorkspaceRoomCheckpoint, "function");
assert.equal(typeof core.decryptWorkspaceRoomCheckpoint, "function");
assert.equal(typeof collaboration.createWorkspaceRoomSyncController, "function");
assert.equal(typeof collaboration.encryptWorkspaceRoomCheckpoint, "function");
assert.equal(typeof roomClient.createHeadlessRoomClient, "function");
assert.equal(typeof roomClient.createHeadlessRoomSyncAdapters, "function");

const actor = core.createRoomActor({
  id: "runtime-smoke-agent",
  kind: "agent",
  client: "tabula-mcp",
});
assert.deepEqual(actor.capabilities, ["presence", "read", "write"]);
