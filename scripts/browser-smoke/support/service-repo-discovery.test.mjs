import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { getSiblingServiceRepoCandidates } from "./service-repo-discovery.mjs";

test("finds a service next to the main checkout from a linked worktree", () => {
  const candidates = getSiblingServiceRepoCandidates({
    cwd: "/Users/example/.codex/worktrees/1234/marker",
    dotGitFile: "gitdir: /Users/example/Documents/marker/.git/worktrees/marker-2\n",
    serviceName: "tabula-room",
  });

  assert.equal(
    candidates.at(-1),
    path.join("/Users/example/Documents", "tabula-room"),
  );
});

test("keeps ordinary checkout sibling discovery as the first fallback", () => {
  const candidates = getSiblingServiceRepoCandidates({
    cwd: "/workspace/marker",
    serviceName: "tabula-room",
  });

  assert.deepEqual(candidates, [
    "/workspace/marker/tabula-room",
    "/workspace/tabula-room",
  ]);
});
