#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateBashCommand } from "../.codex/hooks/lib/command-policy.mjs";
import {
  classifyChangedFiles,
  classifyValidationCommand,
  getMissingValidations,
  parseGitStatusFiles,
  parsePatchFiles,
  recordChangedFiles,
  recordValidationCommand
} from "../.codex/hooks/lib/validation-policy.mjs";
import {
  buildWorkflowReminder,
  classifyWorkflowCommand,
  formatStopReason,
  getMissingWorkflowSteps,
  recordPostMergeSyncRequired,
  recordWorkflowCommand,
  shouldMarkPostMergeSyncRequired
} from "../.codex/hooks/lib/workflow-policy.mjs";

const fixtureRoot = path.resolve(".codex/hooks/fixtures");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function readFixture(fileName) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, fileName), "utf8"));
}

test("blocks raw Git branch creation and PR publishing lifecycle", () => {
  assert.equal(evaluateBashCommand("git checkout -b codex/MTS-123-test").decision, "block");
  assert.equal(evaluateBashCommand("git switch -c codex/MTS-123-test").decision, "block");
  assert.equal(evaluateBashCommand("git commit -m test").decision, "block");
  assert.equal(evaluateBashCommand("git push origin HEAD").decision, "block");
  assert.equal(evaluateBashCommand("gh pr create --draft").decision, "block");
});

test("allows Graphite commands and safe Git passthrough", () => {
  assert.equal(evaluateBashCommand("gt create -am \"[MTS-123] Add layer\"").decision, "allow");
  assert.equal(evaluateBashCommand("gt submit --stack").decision, "allow");
  assert.equal(evaluateBashCommand("git status --short").decision, "allow");
  assert.equal(evaluateBashCommand("git diff -- apps/web/src/App.tsx").decision, "allow");
  assert.equal(evaluateBashCommand("git branch --show-current").decision, "allow");
  assert.equal(evaluateBashCommand("git branch -a").decision, "allow");
  assert.equal(evaluateBashCommand("git stash push -m wip").decision, "allow");
});

test("warns for raw Git navigation and rebase without blocking recovery", () => {
  assert.equal(evaluateBashCommand("git checkout existing-branch").decision, "warn");
  assert.equal(evaluateBashCommand("git rebase main").decision, "warn");
});

test("blocks destructive Git commands", () => {
  assert.equal(evaluateBashCommand("git reset --hard HEAD").decision, "block");
  assert.equal(evaluateBashCommand("git checkout -- apps/web/src/App.tsx").decision, "block");
  assert.equal(evaluateBashCommand("git clean -fd").decision, "block");
  assert.equal(evaluateBashCommand("rm -rf apps/web/src").decision, "block");
});

test("blocks shell source writes under project-owned paths", () => {
  assert.equal(evaluateBashCommand("cat <<'EOF' > apps/web/src/App.tsx\nx\nEOF").decision, "block");
  assert.equal(evaluateBashCommand("printf '%s' test > docs/codex-hooks.md").decision, "block");
  assert.equal(evaluateBashCommand("echo scratch > /tmp/tabula-note.txt").decision, "allow");
});

test("parses apply_patch file paths", () => {
  assert.deepEqual(
    parsePatchFiles(`*** Begin Patch
*** Update File: apps/web/src/App.tsx
@@
*** Add File: docs/codex-hooks.md
*** End Patch`),
    ["apps/web/src/App.tsx", "docs/codex-hooks.md"]
  );
});

test("classifies validation needs by changed file", () => {
  assert.deepEqual(classifyChangedFiles(["apps/web/src/App.tsx"]).needs, {
    build: true,
    browser: true,
    unit: false,
    hooks: false
  });
  assert.deepEqual(classifyChangedFiles([".codex/hooks/lib/command-policy.mjs"]).needs, {
    build: false,
    browser: false,
    unit: false,
    hooks: true
  });
  assert.deepEqual(classifyChangedFiles(["apps/web/src/styles/top-chrome.css"]).browserSuites, ["layout"]);
  assert.deepEqual(classifyChangedFiles(["apps/web/src/components/FileToolbar.tsx"]).browserSuites, ["editor-preview"]);
});

test("classifies observed validation commands", () => {
  assert.deepEqual(classifyValidationCommand("npm run build"), {
    build: true,
    browser: false,
    browserSuites: [],
    unit: false,
    hooks: false
  });
  assert.deepEqual(classifyValidationCommand("npm run test:browser:layout"), {
    build: false,
    browser: true,
    browserSuites: ["layout"],
    unit: false,
    hooks: false
  });
  assert.deepEqual(classifyValidationCommand("TABULA_BROWSER_SMOKE_SUITE=panels npm run test:browser").browserSuites, ["panels"]);
  assert.deepEqual(classifyValidationCommand("npm run test:browser").browserSuites, ["all"]);
  assert.deepEqual(classifyValidationCommand("npm run test:hooks"), {
    build: false,
    browser: false,
    browserSuites: [],
    unit: false,
    hooks: true
  });
});

test("reports validations missing after newer relevant changes", () => {
  let state = {};
  state = recordChangedFiles(state, ["apps/web/src/workspaceStorage.ts"], "2026-06-17T00:00:00.000Z");
  state = recordValidationCommand(state, "npm run build", "2026-06-17T00:01:00.000Z");
  assert.deepEqual(getMissingValidations(state).map((item) => item.command), ["npm run test:browser:workspace"]);
  state = recordValidationCommand(state, "npm run test:browser:workspace", "2026-06-17T00:02:00.000Z");
  assert.deepEqual(getMissingValidations(state), []);
});

test("parses git status output for bash post-tool change detection", () => {
  assert.deepEqual(
    parseGitStatusFiles(` M apps/web/src/App.tsx
?? docs/codex-hooks.md
R  old-name.md -> apps/web/src/components/FileToolbar.tsx`),
    ["apps/web/src/App.tsx", "docs/codex-hooks.md", "apps/web/src/components/FileToolbar.tsx"]
  );
});

test("validates hook policy fixtures", () => {
  for (const fileName of ["bash-git-push.json", "bash-cat-write-block.json"]) {
    const fixture = readFixture(fileName);
    assert.equal(evaluateBashCommand(fixture.command).decision, fixture.expectedDecision, fixture.name);
  }
});

test("validates patch classification fixture", () => {
  const fixture = readFixture("bash-apply-patch-ok.json");
  const files = parsePatchFiles(fixture.patch);
  const classified = classifyChangedFiles(files);
  assert.deepEqual(files, fixture.expectedFiles);
  assert.deepEqual(classified.needs, fixture.expectedNeeds);
  assert.deepEqual(classified.browserSuites, fixture.expectedBrowserSuites);
});

test("validates stop missing browser smoke fixture", () => {
  const fixture = readFixture("stop-missing-browser-smoke.json");
  assert.deepEqual(getMissingValidations(fixture.state).map((item) => item.command), fixture.expectedMissingCommands);
});

test("classifies Graphite workflow commands", () => {
  assert.deepEqual(classifyWorkflowCommand("gt create -am \"[MTS-7] Add hooks\"").map((event) => event.type), ["graphite:create"]);
  assert.deepEqual(classifyWorkflowCommand("gt modify -a").map((event) => event.type), ["graphite:modify"]);
  assert.deepEqual(classifyWorkflowCommand("gt submit --publish --no-edit").map((event) => event.type), ["graphite:submit"]);
  assert.deepEqual(classifyWorkflowCommand("gt sync --delete-all").map((event) => event.type), ["graphite:sync"]);
  assert.deepEqual(classifyWorkflowCommand("npm run pr:metadata -- --label Infra").map((event) => event.label), ["Infra"]);
});

test("reports missing PR metadata only after real submit", () => {
  let state = {};
  state = recordWorkflowCommand(state, "gt create -am \"[MTS-7] Add hooks\"", "2026-06-17T00:00:00.000Z");
  state = recordWorkflowCommand(state, "gt submit --no-edit", "2026-06-17T00:01:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["pr-metadata"]);

  state = recordWorkflowCommand(state, "npm run pr:metadata -- --list-labels", "2026-06-17T00:02:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["pr-metadata"]);

  state = recordWorkflowCommand(state, "npm run pr:metadata -- --label Infra --dry-run", "2026-06-17T00:03:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["pr-metadata"]);

  state = recordWorkflowCommand(state, "npm run pr:metadata -- --label Infra", "2026-06-17T00:04:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state), []);

  state = recordWorkflowCommand(state, "gt submit --publish --no-edit", "2026-06-17T00:05:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state), []);
});

test("formats workflow reminders for prompts and stop continuation", () => {
  assert.match(buildWorkflowReminder("PR #2 머지했어"), /gt sync --delete-all/);
  assert.equal(shouldMarkPostMergeSyncRequired("PR #2 머지했어"), true);
  assert.match(buildWorkflowReminder("패치해줘"), /pr:metadata/);
  assert.equal(buildWorkflowReminder("고마워"), "");
  assert.match(
    formatStopReason({
      missingWorkflowSteps: [{ command: "npm run pr:metadata -- --label <Label>", reason: "metadata missing" }],
      missingValidations: [{ command: "npm run build", reason: "build missing" }]
    }),
    /Finish the Tabula Graphite workflow/
  );
});

test("reports missing post-merge sync until cleanup is observed", () => {
  let state = recordPostMergeSyncRequired({}, "2026-06-17T00:00:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["post-merge-sync"]);
  state = recordWorkflowCommand(state, "gt sync --delete-all", "2026-06-17T00:01:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state), []);
});

console.log("Codex hook policy tests passed.");
