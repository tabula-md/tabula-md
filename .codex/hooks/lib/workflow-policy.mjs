const workflowCommands = {
  create: "gt create",
  modify: "gt modify",
  submit: "gt submit",
  metadata: "npm run pr:metadata -- --label <Label>",
  sync: "gt sync --delete-all"
};

export function classifyWorkflowCommand(command) {
  const normalized = normalizeCommand(command);
  const events = [];

  if (/\bgt\s+(?:branch\s+)?create\b/.test(normalized)) {
    events.push({ type: "graphite:create", command: workflowCommands.create });
  }

  if (/\bgt\s+(?:branch\s+)?modify\b/.test(normalized)) {
    events.push({ type: "graphite:modify", command: workflowCommands.modify });
  }

  if (/\bgt\s+(?:branch\s+)?submit\b/.test(normalized)) {
    events.push({
      type: "graphite:submit",
      command: workflowCommands.submit,
      publish: /\s--publish(?:\s|$)/.test(normalized),
      stack: /\s--stack(?:\s|$)/.test(normalized)
    });
  }

  if (/\bgt\s+sync\b/.test(normalized)) {
    events.push({
      type: "graphite:sync",
      command: workflowCommands.sync,
      deleteAll: /\s--delete-all(?:\s|$)/.test(normalized)
    });
  }

  const metadataLabel = findMetadataLabel(normalized);
  if (/\bnpm\s+run\s+pr:metadata\b/.test(normalized) || /\bnode\s+scripts\/apply-pr-metadata\.mjs\b/.test(normalized)) {
    events.push({
      type: "pr:metadata",
      command: workflowCommands.metadata,
      label: metadataLabel,
      dryRun: /\s--dry-run(?:\s|$)/.test(normalized),
      listLabels: /\s--list-labels(?:\s|$)/.test(normalized)
    });
  }

  if (/\bnpm\s+run\s+workflow:status\b/.test(normalized) || /\bnode\s+scripts\/workflow-status\.mjs\b/.test(normalized)) {
    events.push({ type: "workflow:status", command: "npm run workflow:status" });
  }

  return events;
}

export function recordWorkflowCommand(state, command, timestamp = new Date().toISOString()) {
  const events = classifyWorkflowCommand(command);
  if (events.length === 0) {
    return state;
  }

  const next = normalizeFullState(state);
  const workflow = normalizeWorkflowState(next.workflow);

  for (const event of events) {
    workflow.events.push({ ...event, observedAt: timestamp });
    workflow.events = workflow.events.slice(-50);

    if (event.type === "graphite:create") {
      workflow.lastCreateAt = timestamp;
      workflow.prMetadataRequiredAt = null;
      workflow.prMetadataAppliedAt = null;
    }

    if (event.type === "graphite:modify") {
      workflow.lastModifyAt = timestamp;
    }

    if (event.type === "graphite:submit") {
      workflow.lastSubmitAt = timestamp;
      workflow.lastSubmitWasPublish = event.publish;
      if (!workflow.prMetadataAppliedAt) {
        workflow.prMetadataRequiredAt = timestamp;
      }
    }

    if (event.type === "pr:metadata" && event.label && !event.dryRun && !event.listLabels) {
      workflow.prMetadataAppliedAt = timestamp;
      workflow.prMetadataLabel = event.label;
    }

    if (event.type === "graphite:sync") {
      workflow.lastSyncAt = timestamp;
      workflow.lastSyncDeletedAll = event.deleteAll;
      workflow.postMergeSyncRequiredAt = null;
    }
  }

  workflow.updatedAt = timestamp;
  next.workflow = workflow;
  next.updatedAt = timestamp;
  return next;
}

export function recordPostMergeSyncRequired(state, timestamp = new Date().toISOString()) {
  const next = normalizeFullState(state);
  const workflow = normalizeWorkflowState(next.workflow);
  workflow.postMergeSyncRequiredAt = timestamp;
  workflow.updatedAt = timestamp;
  next.workflow = workflow;
  next.updatedAt = timestamp;
  return next;
}

export function getMissingWorkflowSteps(state) {
  const workflow = normalizeWorkflowState(state?.workflow);
  const missing = [];

  if (workflow.prMetadataRequiredAt && (!workflow.prMetadataAppliedAt || workflow.prMetadataAppliedAt < workflow.prMetadataRequiredAt)) {
    missing.push({
      key: "pr-metadata",
      requiredAt: workflow.prMetadataRequiredAt,
      command: workflowCommands.metadata,
      reason: "Graphite submit was observed, but PR metadata was not applied afterward."
    });
  }

  if (workflow.postMergeSyncRequiredAt && (!workflow.lastSyncAt || workflow.lastSyncAt < workflow.postMergeSyncRequiredAt)) {
    missing.push({
      key: "post-merge-sync",
      requiredAt: workflow.postMergeSyncRequiredAt,
      command: workflowCommands.sync,
      reason: "A merged PR needs local Graphite cleanup."
    });
  }

  return missing;
}

export function buildWorkflowReminder(prompt) {
  const text = String(prompt ?? "").toLowerCase();

  if (isPostMergePrompt(text)) {
    return "A PR may have been merged. Verify the PR state, run `gt sync --delete-all`, `git remote prune origin`, and `npm run workflow:doctor`, confirm `gt log short --all` shows only active branches, and move the Linear issue to Done when appropriate.";
  }

  if (/(패치|구현|수정|고쳐|작업|개발|pr|graphite|linear|hook|commit|submit|올려)/i.test(text)) {
    return "For Tabula PR-bound work: classify the work first, create or reuse a Linear MTS issue for accepted maintainer work, keep PR-bound changes on Graphite branches, submit with `gt submit` or `gt submit --stack`, then run `npm run pr:metadata -- --label <Label>` using `.github/labels.json`.";
  }

  return "";
}

export function shouldMarkPostMergeSyncRequired(prompt) {
  return isPostMergePrompt(String(prompt ?? "").toLowerCase());
}

export function formatStopReason({ missingValidations = [], missingWorkflowSteps = [] }) {
  const lines = [];

  if (missingWorkflowSteps.length > 0) {
    lines.push("Finish the Tabula Graphite workflow before responding:");
    for (const item of missingWorkflowSteps) {
      lines.push(`- ${item.command}: ${item.reason}`);
    }
  }

  if (missingValidations.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("Run or explicitly account for missing Tabula validation:");
    for (const item of missingValidations) {
      lines.push(`- ${item.command}: ${item.reason}`);
    }
  }

  return lines.join("\n");
}

export function normalizeWorkflowState(workflow) {
  return {
    events: Array.isArray(workflow?.events) ? workflow.events : [],
    lastCreateAt: stringOrNull(workflow?.lastCreateAt),
    lastModifyAt: stringOrNull(workflow?.lastModifyAt),
    lastSubmitAt: stringOrNull(workflow?.lastSubmitAt),
    lastSubmitWasPublish: Boolean(workflow?.lastSubmitWasPublish),
    prMetadataRequiredAt: stringOrNull(workflow?.prMetadataRequiredAt),
    prMetadataAppliedAt: stringOrNull(workflow?.prMetadataAppliedAt),
    prMetadataLabel: stringOrNull(workflow?.prMetadataLabel),
    postMergeSyncRequiredAt: stringOrNull(workflow?.postMergeSyncRequiredAt),
    lastSyncAt: stringOrNull(workflow?.lastSyncAt),
    lastSyncDeletedAll: Boolean(workflow?.lastSyncDeletedAll),
    updatedAt: stringOrNull(workflow?.updatedAt)
  };
}

function normalizeFullState(state) {
  return state && typeof state === "object" && !Array.isArray(state) ? { ...state } : {};
}

function normalizeCommand(command) {
  return String(command ?? "").replace(/\s+/g, " ").trim();
}

function findMetadataLabel(command) {
  return command.match(/(?:^|\s)--label(?:=|\s+)([^\s]+)/)?.[1]
    ?? command.match(/(?:^|\s)--labels(?:=|\s+)([^\s]+)/)?.[1]
    ?? null;
}

function isPostMergePrompt(text) {
  return /(머지했|merged|merge 완료|pr .*merged|합쳤)/i.test(text);
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
