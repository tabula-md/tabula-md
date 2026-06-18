#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateBashCommand } from "../.codex/hooks/lib/command-policy.mjs";
import { findBashCommand } from "../.codex/hooks/lib/hook-io.mjs";
import {
  classifyChangedFiles,
  classifyValidationCommand,
  filterMissingValidationsForChangedFiles,
  getCurrentTurnMissingValidations,
  getMissingValidations,
  parseGitStatusFiles,
  parsePatchFiles,
  recordChangedFiles,
  recordValidationCommand,
  shouldRecordGitStatusAfterCommand
} from "../.codex/hooks/lib/validation-policy.mjs";
import {
  buildWorkflowReminder,
  evaluatePromptInput,
  findPromptSecrets,
  classifyWorkflowCommand,
  formatStopReason,
  getCurrentTurnMissingWorkflowSteps,
  getMissingWorkflowSteps,
  recordPromptSubmitted,
  recordPostMergeSyncRequired,
  recordWorkflowCommand,
  clearPrHandoffRequirements,
  shouldBlockForMissingWorkflowSteps,
  shouldMarkPostMergeSyncRequired
} from "../.codex/hooks/lib/workflow-policy.mjs";
import { hasCurrentPullRequestHandoffComplete } from "../.codex/hooks/lib/workflow-status.mjs";
import {
  checkBranchName,
  checkConventionalTitle,
  checkPrLabels,
  checkPrTemplateBody,
  checkStatusChecks,
  hasFailures,
  parseGitCountObjects,
  parseArgs
} from "./lib/workflow-automation.mjs";
import { parseAgentSection, upsertAgentSection } from "./lib/agent-context.mjs";

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
  assert.equal(evaluateBashCommand("gt push origin HEAD").decision, "block");
  assert.equal(evaluateBashCommand("gt pull --rebase").decision, "block");
  assert.equal(evaluateBashCommand("npm run pr:handoff -- --summary \"Blocked gt push and gt pull passthrough\"").decision, "allow");
  assert.equal(evaluateBashCommand("gh pr create --draft").decision, "block");
  assert.equal(evaluateBashCommand("gh pr ready 5").decision, "block");
  assert.equal(evaluateBashCommand("gh pr edit 5 --body-file body.md").decision, "block");
  assert.equal(evaluateBashCommand("gh api --method PATCH repos/tabula-md/tabula-md/pulls/5").decision, "block");
  assert.equal(evaluateBashCommand("gh api -X DELETE repos/tabula-md/tabula-md/git/refs/heads/graphite-base/4").decision, "block");
  assert.equal(evaluateBashCommand("gh api repos/tabula-md/tabula-md/pulls/5").decision, "allow");
});

test("allows Graphite commands and safe Git passthrough", () => {
  assert.equal(evaluateBashCommand("gt create codex/hook-policy -m \"chore(codex): update hook policy\"").decision, "allow");
  assert.equal(evaluateBashCommand("gt submit --stack").decision, "allow");
  assert.equal(evaluateBashCommand("git status --short").decision, "allow");
  assert.equal(evaluateBashCommand("git diff -- apps/web/src/App.tsx").decision, "allow");
  assert.equal(evaluateBashCommand("git branch --show-current").decision, "allow");
  assert.equal(evaluateBashCommand("git branch -a").decision, "allow");
  assert.equal(evaluateBashCommand("git stash push -m wip").decision, "allow");
});

test("reads bash commands only from explicit command input fields", () => {
  assert.equal(findBashCommand({ command: "npm run workflow:status" }), "npm run workflow:status");
  assert.equal(findBashCommand({ tool_input: { cmd: "git status --short" } }), "git status --short");
  assert.equal(
    findBashCommand({
      tool_output: {
        stdout: "Next action: run validation, `gt submit`, `npm run pr:title -- --title \"type(scope): summary\"`, `npm run pr:body -- ...`, then `npm run pr:metadata -- --label <Label>`."
      }
    }),
    ""
  );
  assert.equal(
    findBashCommand({
      result: "diff --git a/WORKFLOW.md b/WORKFLOW.md\n+gt submit --stack\n+npm run workflow:sync"
    }),
    ""
  );
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
  assert.equal(evaluateBashCommand("printf '%s' test > docs/README.md").decision, "block");
  assert.equal(evaluateBashCommand("node -e 'fs.writeFileSync(\"apps/web/src/App.tsx\", \"x\")'").decision, "block");
  assert.equal(evaluateBashCommand("node -e 'fs.writeFileSync(\".codex/hooks.json\", \"x\")'").decision, "block");
  assert.equal(evaluateBashCommand("node -e 'fs.writeFileSync(\".codex/hooks/lib/tmp.mjs\", \"x\")'").decision, "block");
  assert.equal(evaluateBashCommand("python -c 'from pathlib import Path; Path(\"scripts/tmp.mjs\").write_text(\"x\")'").decision, "block");
  assert.equal(evaluateBashCommand("node -e 'fs.writeFileSync(\"/tmp/out\", \".codex/hooks.json\")'").decision, "allow");
  assert.equal(evaluateBashCommand("node -e 'fs.writeFileSync(\".codex/hooks.json.backup\", \"x\")'").decision, "allow");
  assert.equal(evaluateBashCommand("node -e 'fs.writeFileSync(\".codex/hook-state/session.json\", \"{}\")'").decision, "allow");
  assert.equal(evaluateBashCommand("echo scratch > /tmp/tabula-note.txt").decision, "allow");
});

test("parses apply_patch file paths", () => {
  assert.deepEqual(
    parsePatchFiles(`*** Begin Patch
*** Update File: apps/web/src/App.tsx
@@
*** Add File: docs/README.md
*** End Patch`),
    ["apps/web/src/App.tsx", "docs/README.md"]
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

test("reports stop validation reminders only for current-turn changes", () => {
  let state = {};
  state = recordChangedFiles(state, ["apps/web/src/App.tsx"], "2026-06-17T00:00:00.000Z");
  state = recordPromptSubmitted(state, "2026-06-17T00:01:00.000Z");
  assert.deepEqual(getCurrentTurnMissingValidations(state).map((item) => item.key), []);

  state = recordChangedFiles(state, ["apps/web/src/components/FileToolbar.tsx"], "2026-06-17T00:02:00.000Z");
  assert.deepEqual(getCurrentTurnMissingValidations(state).map((item) => item.key), ["build", "browser"]);
});

test("filters stale validation reminders to current branch files", () => {
  const missing = [
    { key: "build", requiredAt: "2026-06-17T00:00:00.000Z", command: "npm run build", reason: "build" },
    { key: "browser", requiredAt: "2026-06-17T00:00:00.000Z", command: "npm run test:browser", reason: "browser" },
    { key: "hooks", requiredAt: "2026-06-17T00:00:00.000Z", command: "npm run test:hooks", reason: "hooks" }
  ];

  assert.deepEqual(
    filterMissingValidationsForChangedFiles(missing, [".codex/hooks/lib/workflow-status.mjs"]).map((item) => item.key),
    ["hooks"]
  );
});

test("parses git status output for bash post-tool change detection", () => {
  assert.deepEqual(
    parseGitStatusFiles(` M apps/web/src/App.tsx
?? docs/README.md
R  old-name.md -> apps/web/src/components/FileToolbar.tsx`),
    ["apps/web/src/App.tsx", "docs/README.md", "apps/web/src/components/FileToolbar.tsx"]
  );
  assert.equal(shouldRecordGitStatusAfterCommand("npm run workflow:status"), false);
  assert.equal(shouldRecordGitStatusAfterCommand("git diff -- WORKFLOW.md"), false);
  assert.equal(shouldRecordGitStatusAfterCommand("npm run test:hooks"), false);
  assert.equal(shouldRecordGitStatusAfterCommand("npm install"), true);
  assert.equal(shouldRecordGitStatusAfterCommand("prettier --write AGENTS.md"), true);
  assert.equal(shouldRecordGitStatusAfterCommand("node -e 'fs.writeFileSync(\".codex/hook-state/session.json\", \"{}\")'"), true);
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
  assert.deepEqual(classifyWorkflowCommand("gt create -am \"chore(codex): add hooks\"").map((event) => event.type), ["graphite:create"]);
  assert.deepEqual(classifyWorkflowCommand("gt modify -a").map((event) => event.type), ["graphite:modify"]);
  assert.deepEqual(classifyWorkflowCommand("gt submit --publish --update-only").map((event) => event.type), ["graphite:submit"]);
  assert.deepEqual(classifyWorkflowCommand("gt submit --dry-run --no-edit").map((event) => event.dryRun), [true]);
  assert.deepEqual(classifyWorkflowCommand("gt sync --delete-all").map((event) => event.type), ["graphite:sync"]);
  assert.deepEqual(classifyWorkflowCommand("npm run workflow:sync").map((event) => event.type), ["graphite:sync"]);
  assert.deepEqual(classifyWorkflowCommand("npm run pr:title -- --title \"chore(workflow): standardize agent workflow automation\"").map((event) => event.type), ["pr:title"]);
  assert.deepEqual(classifyWorkflowCommand("npm run pr:body -- --summary test").map((event) => event.type), ["pr:body"]);
  assert.deepEqual(classifyWorkflowCommand("npm run pr:metadata -- --label Infra").map((event) => event.label), ["Infra"]);
  assert.deepEqual(classifyWorkflowCommand("npm run pr:handoff -- --title \"chore(workflow): add handoff\" --label Infra --summary x --review-focus x --implementation-notes x --validation-automated x --risk x --evidence x").map((event) => event.type), ["pr:handoff"]);
});

test("reports missing PR title, body, and metadata only after real submit", () => {
  let state = {};
  state = recordWorkflowCommand(state, "gt submit --dry-run --no-edit", "2026-06-17T00:00:30.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state), []);

  state = recordWorkflowCommand(state, "gt create -am \"chore(codex): add hooks\"", "2026-06-17T00:00:00.000Z");
  state = recordWorkflowCommand(state, "gt submit --no-edit", "2026-06-17T00:01:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["pr-title", "pr-body", "pr-metadata"]);

  state = recordWorkflowCommand(state, "npm run pr:metadata -- --list-labels", "2026-06-17T00:02:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["pr-title", "pr-body", "pr-metadata"]);

  state = recordWorkflowCommand(state, "npm run pr:metadata -- --label Infra --dry-run", "2026-06-17T00:03:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["pr-title", "pr-body", "pr-metadata"]);

  state = recordWorkflowCommand(state, "npm run pr:title -- --title \"chore(codex): add hooks\"", "2026-06-17T00:03:15.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["pr-body", "pr-metadata"]);

  state = recordWorkflowCommand(state, "npm run pr:body -- --summary test", "2026-06-17T00:03:30.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["pr-metadata"]);

  state = recordWorkflowCommand(state, "npm run pr:metadata -- --label Infra", "2026-06-17T00:04:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state), []);

  state = recordWorkflowCommand(state, "gt submit --publish --update-only", "2026-06-17T00:05:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state), []);
});

test("treats PR handoff as completing title body and metadata workflow steps", () => {
  let state = recordWorkflowCommand({}, "gt submit --no-edit", "2026-06-17T00:01:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["pr-title", "pr-body", "pr-metadata"]);

  state = recordWorkflowCommand(
    state,
    "npm run pr:handoff -- --title \"chore(workflow): add handoff\" --label Infra --summary x --review-focus x --implementation-notes x --validation-automated x --risk x --evidence x",
    "2026-06-17T00:02:00.000Z"
  );
  assert.deepEqual(getMissingWorkflowSteps(state), []);
});

test("clears stale PR handoff requirements when the current PR is already complete", () => {
  let state = recordWorkflowCommand({}, "gt submit --no-edit", "2026-06-17T00:01:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["pr-title", "pr-body", "pr-metadata"]);

  state = clearPrHandoffRequirements(state, "2026-06-17T00:02:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state), []);
});

test("blocks missing Graphite handoff only for the current turn", () => {
  let state = {};
  state = recordWorkflowCommand(state, "gt submit --no-edit", "2026-06-17T00:01:00.000Z");
  assert.equal(shouldBlockForMissingWorkflowSteps(state), true);
  assert.deepEqual(getCurrentTurnMissingWorkflowSteps(state).map((item) => item.key), ["pr-title", "pr-body", "pr-metadata"]);

  state = recordPromptSubmitted(state, "2026-06-17T00:02:00.000Z");
  assert.equal(shouldBlockForMissingWorkflowSteps(state), false);
  assert.deepEqual(getCurrentTurnMissingWorkflowSteps(state), []);
  assert.match(
    formatStopReason({
      missingWorkflowSteps: getMissingWorkflowSteps(state),
      blockingWorkflow: shouldBlockForMissingWorkflowSteps(state)
    }),
    /Pending Tabula workflow reminder/
  );

  state = recordWorkflowCommand(state, "gt submit --no-edit", "2026-06-17T00:03:00.000Z");
  assert.equal(shouldBlockForMissingWorkflowSteps(state), true);
  assert.deepEqual(getCurrentTurnMissingWorkflowSteps(state).map((item) => item.key), ["pr-title", "pr-body", "pr-metadata"]);
  assert.match(
    formatStopReason({
      missingWorkflowSteps: getCurrentTurnMissingWorkflowSteps(state),
      blockingWorkflow: shouldBlockForMissingWorkflowSteps(state)
    }),
    /before responding/
  );
});

test("formats workflow reminders for prompts and stop continuation", () => {
  assert.match(buildWorkflowReminder("PR #2 머지했어"), /workflow:sync/);
  assert.equal(shouldMarkPostMergeSyncRequired("PR #2 머지했어"), true);
  assert.equal(shouldMarkPostMergeSyncRequired("머지했어"), true);
  assert.equal(shouldMarkPostMergeSyncRequired("PR #2 merged"), true);
  assert.equal(shouldMarkPostMergeSyncRequired("Graphite에서 merged branch는 뭐야?"), false);
  assert.equal(
    shouldMarkPostMergeSyncRequired("내가 Graphite에서 머지하고 머지 완료돼서 당신에게 '머지했어'라고 말한 시점에서 이전으로 돌아가고 싶다면?"),
    false
  );
  assert.equal(shouldMarkPostMergeSyncRequired("만약 PR을 머지했어 라고 말하면 어떻게 돼?"), false);
  assert.equal(buildWorkflowReminder("패치해줘"), "");
  assert.equal(buildWorkflowReminder("Graphite 설명해줘"), "");
  assert.equal(buildWorkflowReminder("hook 구조 평가해줘"), "");
  assert.equal(buildWorkflowReminder("Linear 이슈가 뭔지 알려줘"), "");
  assert.equal(buildWorkflowReminder("고마워"), "");
  assert.equal(evaluatePromptInput("패치해줘").decision, "allow");
  assert.equal(evaluatePromptInput("패치해줘").additionalContext, "");
  assert.match(
    formatStopReason({
      missingWorkflowSteps: [{ command: "npm run pr:body -- ...", reason: "body missing" }],
      missingValidations: [{ command: "npm run build", reason: "build missing" }]
    }),
    /Finish the Tabula Graphite workflow/
  );
});

test("blocks obvious secrets in user prompts", () => {
  assert.deepEqual(findPromptSecrets("OPENAI_API_KEY=sk-proj_abcdefghijklmnopqrstuvwxyz123456"), ["OpenAI API key", "secret assignment"]);
  assert.deepEqual(findPromptSecrets("Use OPENAI_API_KEY=<redacted> in env"), []);
  assert.equal(evaluatePromptInput("github_pat_abcdefghijklmnopqrstuvwxyz1234567890").decision, "block");
  assert.match(evaluatePromptInput("-----BEGIN PRIVATE KEY-----").reason, /Potential secret/);
});

test("reports missing post-merge sync until cleanup is observed", () => {
  let state = recordPostMergeSyncRequired({}, "2026-06-17T00:00:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state).map((item) => item.key), ["post-merge-sync"]);
  state = recordWorkflowCommand(state, "npm run workflow:sync", "2026-06-17T00:01:00.000Z");
  assert.deepEqual(getMissingWorkflowSteps(state), []);
});

test("checks PR readiness policy helpers", () => {
  const publicPrBody = `## Summary

- Tightened the PR body workflow.

## Review Focus

- Confirm the readiness check now rejects empty template sections.

## Implementation Notes

- PR body authoring is agent-written and script-applied.

## Validation

- Automated: npm run test:hooks
- Manual: Reviewed generated PR body shape.
- Not run: Browser smoke; not visual.

## Risk

- Low; workflow tooling only.

## Evidence

- Not visual.`;
  const emptyPrBody = "## Summary\n\n-\n\n## Review Focus\n\n-\n\n## Implementation Notes\n\n-\n\n## Validation\n\n- Automated:\n- Manual:\n- Not run:\n\n## Risk\n\n-\n\n## Evidence\n\n- Screenshots/video:";
  const agentPrBody = publicPrBody.replace(
    "## Validation",
    "## Agent\n\n- Tool: Codex\n- Session: 019ed132-9bc9-7a11-a31d-6bc08a92d5ff\n\n## Validation"
  );
  const unknownAgentBody = publicPrBody.replace(
    "## Validation",
    "## Agent\n\n- Tool: Codex\n- Session: Unknown\n\n## Validation"
  );
  const labelCatalog = [{ name: "Infra" }, { name: "Docs" }];

  assert.equal(checkConventionalTitle("fix(layout): keep rail aligned").level, "ok");
  assert.equal(checkConventionalTitle("[MTS-7] Keep rail aligned").level, "fail");
  assert.deepEqual(checkBranchName("layout-rail-alignment").map((check) => check.level), ["ok"]);
  assert.deepEqual(checkBranchName("codex/workflow-public-readiness").map((check) => check.level), ["ok"]);
  assert.deepEqual(checkBranchName("claude/readme-polish").map((check) => check.level), ["ok"]);
  assert.deepEqual(checkBranchName("cursor/editor-toolbar-copy").map((check) => check.level), ["ok"]);
  assert.deepEqual(checkBranchName("agent/aider/refactor-markdown-parser").map((check) => check.level), ["ok"]);
  assert.deepEqual(checkBranchName("dev/taehalim/editor-rail-alignment").map((check) => check.level), ["ok"]);
  assert.equal(checkBranchName("06-17-_mts-7_add_workflow_entrypoint").some((check) => check.level === "warn"), true);
  assert.equal(checkBranchName("chore_workflow_clean_stale_graphite_temp_branches").some((check) => check.level === "warn"), true);
  assert.equal(hasFailures(checkPrTemplateBody(publicPrBody, { branch: "dev/taehalim/docs-polish" })), false);
  assert.equal(hasFailures(checkPrTemplateBody(emptyPrBody, { branch: "dev/taehalim/docs-polish" })), true);
  assert.equal(hasFailures(checkPrTemplateBody(publicPrBody, { branch: "codex/docs-polish" })), true);
  assert.equal(hasFailures(checkPrTemplateBody(publicPrBody, { branch: "claude/docs-polish" })), true);
  assert.equal(hasFailures(checkPrTemplateBody(publicPrBody, { branch: "cursor/docs-polish" })), true);
  assert.equal(hasFailures(checkPrTemplateBody(publicPrBody, { branch: "agent/aider/docs-polish" })), true);
  assert.equal(hasFailures(checkPrTemplateBody(agentPrBody, { branch: "codex/docs-polish" })), false);
  assert.equal(hasFailures(checkPrTemplateBody(unknownAgentBody, { branch: "codex/docs-polish" })), true);
  assert.equal(hasFailures(checkPrTemplateBody("## Summary")), true);
  assert.deepEqual(checkPrLabels([{ name: "Infra" }], labelCatalog).map((check) => check.level), ["ok"]);
  assert.equal(hasFailures(checkPrLabels([{ name: "Infra" }, { name: "Docs" }], labelCatalog)), true);
  assert.deepEqual(checkStatusChecks([{ name: "Verify", conclusion: "SUCCESS" }]).map((check) => check.level), ["ok"]);
  assert.deepEqual(checkStatusChecks([{ name: "Verify", status: "PENDING" }]).map((check) => check.level), ["warn"]);
  assert.throws(() => parseArgs(["--fix"]), /explicit fix flag/);
  assert.equal(parseArgs(["--delete-stale-graphite-base"]).deleteStaleGraphiteBase, true);
  assert.throws(() => parseArgs(["--sync-labels"], { allowWorkflowFixFlags: false }), /Unknown option/);
  assert.equal(parseArgs(["--post-merge"], { allowWorkflowFixFlags: false, allowMaintenanceFlags: true }).postMerge, true);
  assert.equal(parseArgs(["--register"], { allowWorkflowFixFlags: false, allowMaintenanceFlags: true }).register, true);
  assert.throws(() => parseArgs(["--post-merge"], { allowWorkflowFixFlags: false }), /Unknown option/);
});

test("detects complete current PR handoff from live PR metadata shape", () => {
  const status = {
    branch: "codex/test-hook",
    currentCommitTitle: "chore(workflow): tighten hook state",
    pr: {
      state: "OPEN",
      isDraft: false,
      title: "chore(workflow): tighten hook state",
      labels: [{ name: "Infra" }],
      assignees: [{ login: "taehalim" }],
      body: `## Summary

- Tightened hook state cleanup.

## Review Focus

- Confirm stale PR handoff warnings clear when metadata is already complete.

## Implementation Notes

- Stop hook checks current PR metadata before repeating old pending state.

## Agent

- Tool: Codex
- Session: 019ed132-9bc9-7a11-a31d-6bc08a92d5ff

## Validation

- Automated: npm run test:hooks
- Manual: None.
- Not run: None.

## Risk

- Low; hook policy only.

## Evidence

- Unit coverage exercises complete metadata.`
    }
  };

  assert.equal(hasCurrentPullRequestHandoffComplete(status, process.cwd()), true);
  assert.equal(hasCurrentPullRequestHandoffComplete({ ...status, pr: { ...status.pr, labels: [] } }, process.cwd()), false);
});

test("parses git count-objects output", () => {
  assert.deepEqual(
    parseGitCountObjects(`count: 7597
size: 40.51 MiB
in-pack: 338
packs: 2
size-pack: 353.55 KiB
prune-packable: 0
garbage: 0
size-garbage: 0 bytes`),
    {
      count: 7597,
      size: "40.51 MiB",
      inPack: 338,
      packs: 2,
      prunePackable: 0,
      garbage: 0,
      sizeGarbage: "0 bytes"
    }
  );
});

test("upserts PR agent context", () => {
  const body = upsertAgentSection("## Summary\n\n-\n\n## Validation\n\n- Automated:", {
    tool: "Codex",
    session: "session-123"
  });

  assert.match(body, /## Agent/);
  assert.deepEqual(parseAgentSection(body), {
    present: true,
    tool: "Codex",
    session: "session-123"
  });

  const updated = upsertAgentSection(body, {
    tool: "Claude Code",
    session: "session-456"
  });

  assert.equal((updated.match(/^## Agent$/gm) ?? []).length, 1);
  assert.deepEqual(parseAgentSection(updated), {
    present: true,
    tool: "Claude Code",
    session: "session-456"
  });
});

console.log("Codex hook policy tests passed.");
