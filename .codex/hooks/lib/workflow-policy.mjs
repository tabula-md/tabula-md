const workflowCommands = {
  create: "gt create",
  modify: "gt modify",
  submit: "gt submit",
  title: "npm run pr:title -- --title <type(scope): summary>",
  body: "npm run pr:body -- --summary <text> --review-focus <text> --implementation-notes <text> --validation-automated <cmd> --risk <text> --evidence <text>",
  metadata: "npm run pr:metadata -- --label <Label>",
  sync: "npm run workflow:sync"
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
      dryRun: /\s--dry-run(?:\s|$)/.test(normalized),
      publish: /\s--publish(?:\s|$)/.test(normalized),
      updateOnly: /\s--update-only(?:\s|$)/.test(normalized),
      stack: /\s--stack(?:\s|$)/.test(normalized)
    });
  }

  if (/\bnpm\s+run\s+pr:body\b/.test(normalized) || /\bnode\s+scripts\/pr-body\.mjs\b/.test(normalized)) {
    events.push({
      type: "pr:body",
      command: workflowCommands.body,
      dryRun: /\s--dry-run(?:\s|$)/.test(normalized)
    });
  }

  if (/\bnpm\s+run\s+pr:title\b/.test(normalized) || /\bnode\s+scripts\/pr-title\.mjs\b/.test(normalized)) {
    events.push({
      type: "pr:title",
      command: workflowCommands.title,
      dryRun: /\s--dry-run(?:\s|$)/.test(normalized)
    });
  }

  if (/\bgt\s+sync\b/.test(normalized) || /\bnpm\s+run\s+workflow:sync\b/.test(normalized) || /\bnode\s+scripts\/workflow-sync\.mjs\b/.test(normalized)) {
    events.push({
      type: "graphite:sync",
      command: workflowCommands.sync,
      deleteAll: /\bnpm\s+run\s+workflow:sync\b/.test(normalized) || /\bnode\s+scripts\/workflow-sync\.mjs\b/.test(normalized) || /\s--delete-all(?:\s|$)/.test(normalized)
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
      workflow.prTitleRequiredAt = null;
      workflow.prTitleAppliedAt = null;
      workflow.prBodyRequiredAt = null;
      workflow.prBodyAppliedAt = null;
      workflow.prMetadataRequiredAt = null;
      workflow.prMetadataAppliedAt = null;
    }

    if (event.type === "graphite:modify") {
      workflow.lastModifyAt = timestamp;
    }

    if (event.type === "graphite:submit" && !event.dryRun) {
      workflow.lastSubmitAt = timestamp;
      workflow.lastSubmitWasPublish = event.publish;
      if (!(event.publish && event.updateOnly && workflow.prTitleAppliedAt)) {
        workflow.prTitleRequiredAt = timestamp;
      }
      if (!(event.publish && event.updateOnly && workflow.prBodyAppliedAt)) {
        workflow.prBodyRequiredAt = timestamp;
      }
      if (!workflow.prMetadataAppliedAt) {
        workflow.prMetadataRequiredAt = timestamp;
      }
    }

    if (event.type === "pr:body" && !event.dryRun) {
      workflow.prBodyAppliedAt = timestamp;
    }

    if (event.type === "pr:title" && !event.dryRun) {
      workflow.prTitleAppliedAt = timestamp;
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

export function recordPromptSubmitted(state, timestamp = new Date().toISOString()) {
  const next = normalizeFullState(state);
  const workflow = normalizeWorkflowState(next.workflow);
  workflow.currentTurnStartedAt = timestamp;
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

export function clearPrHandoffRequirements(state, timestamp = new Date().toISOString()) {
  const next = normalizeFullState(state);
  const workflow = normalizeWorkflowState(next.workflow);
  workflow.prTitleRequiredAt = null;
  workflow.prBodyRequiredAt = null;
  workflow.prMetadataRequiredAt = null;
  workflow.updatedAt = timestamp;
  next.workflow = workflow;
  next.updatedAt = timestamp;
  return next;
}

export function getMissingWorkflowSteps(state) {
  const workflow = normalizeWorkflowState(state?.workflow);
  const missing = [];

  if (workflow.prTitleRequiredAt && (!workflow.prTitleAppliedAt || workflow.prTitleAppliedAt < workflow.prTitleRequiredAt)) {
    missing.push({
      key: "pr-title",
      requiredAt: workflow.prTitleRequiredAt,
      command: workflowCommands.title,
      reason: "Graphite submit was observed, but the PR title was not reviewed afterward."
    });
  }

  if (workflow.prMetadataRequiredAt && (!workflow.prMetadataAppliedAt || workflow.prMetadataAppliedAt < workflow.prMetadataRequiredAt)) {
    if (workflow.prBodyRequiredAt && (!workflow.prBodyAppliedAt || workflow.prBodyAppliedAt < workflow.prBodyRequiredAt)) {
      missing.push({
        key: "pr-body",
        requiredAt: workflow.prBodyRequiredAt,
        command: workflowCommands.body,
        reason: "Graphite submit was observed, but the PR body was not written afterward."
      });
    }

    missing.push({
      key: "pr-metadata",
      requiredAt: workflow.prMetadataRequiredAt,
      command: workflowCommands.metadata,
      reason: "Graphite submit was observed, but PR metadata was not applied afterward."
    });
  }

  if (
    (!workflow.prMetadataRequiredAt || (workflow.prMetadataAppliedAt && workflow.prMetadataAppliedAt >= workflow.prMetadataRequiredAt))
    && workflow.prBodyRequiredAt
    && (!workflow.prBodyAppliedAt || workflow.prBodyAppliedAt < workflow.prBodyRequiredAt)
  ) {
    missing.push({
      key: "pr-body",
      requiredAt: workflow.prBodyRequiredAt,
      command: workflowCommands.body,
      reason: "Graphite submit was observed, but the PR body was not written afterward."
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

export function shouldBlockForMissingWorkflowSteps(state, missingWorkflowSteps = getMissingWorkflowSteps(state)) {
  return getCurrentTurnMissingWorkflowSteps(state, missingWorkflowSteps).length > 0;
}

export function getCurrentTurnMissingWorkflowSteps(state, missingWorkflowSteps = getMissingWorkflowSteps(state)) {
  const workflow = normalizeWorkflowState(state?.workflow);
  if (!workflow.currentTurnStartedAt) {
    return missingWorkflowSteps;
  }

  return missingWorkflowSteps.filter((item) => item.requiredAt >= workflow.currentTurnStartedAt);
}

export function buildWorkflowReminder(prompt) {
  const text = String(prompt ?? "");
  const normalized = text.toLowerCase();

  if (isPostMergePrompt(normalized)) {
    return "A PR may have been merged. Run `npm run workflow:sync`, confirm only active Graphite branches remain, and move the Linear issue to Done when appropriate.";
  }

  return "";
}

export function evaluatePromptInput(prompt) {
  const secretFindings = findPromptSecrets(prompt);
  if (secretFindings.length > 0) {
    return {
      decision: "block",
      reason: `Potential secret detected in the prompt (${secretFindings.join(", ")}). Remove the secret and rotate it before continuing.`
    };
  }

  return {
    decision: "allow",
    additionalContext: buildWorkflowReminder(prompt)
  };
}

export function findPromptSecrets(prompt) {
  const text = String(prompt ?? "");
  const findings = [];

  for (const { name, pattern } of secretPatterns) {
    if (pattern.test(text)) {
      findings.push(name);
    }
  }

  return [...new Set(findings)];
}

export function shouldMarkPostMergeSyncRequired(prompt) {
  return isPostMergePrompt(String(prompt ?? "").toLowerCase());
}

export function formatStopReason({ missingValidations = [], missingWorkflowSteps = [], blockingWorkflow = true }) {
  const lines = [];

  if (missingWorkflowSteps.length > 0) {
    lines.push(blockingWorkflow ? "Finish the Tabula Graphite workflow before responding:" : "Pending Tabula workflow reminder:");
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
    prTitleRequiredAt: stringOrNull(workflow?.prTitleRequiredAt),
    prTitleAppliedAt: stringOrNull(workflow?.prTitleAppliedAt),
    prBodyRequiredAt: stringOrNull(workflow?.prBodyRequiredAt),
    prBodyAppliedAt: stringOrNull(workflow?.prBodyAppliedAt),
    currentTurnStartedAt: stringOrNull(workflow?.currentTurnStartedAt),
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
  const normalized = String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) {
    return false;
  }

  if (/(라고|라는|한다고|한다면|하면|했다면|시점|예를\s*들|가정|hypothetical|if\s+|when\s+)/i.test(normalized)) {
    return false;
  }

  return [
    /^(?:pr\s*#?\d+\s*)?(?:머지했어|머지했습니다|머지 완료|합쳤어|합쳤습니다)(?:[.!?。]|$)/i,
    /^pr\s*#?\d+.*\b(?:merged|merge complete)\b/i,
    /^(?:merged|merge complete)\s+pr\s*#?\d+/i
  ].some((pattern) => pattern.test(normalized));
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const secretPatterns = [
  {
    name: "private key block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/
  },
  {
    name: "OpenAI API key",
    pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/
  },
  {
    name: "Anthropic API key",
    pattern: /\bsk-ant-[A-Za-z0-9_-]{24,}\b/
  },
  {
    name: "GitHub token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{24,}\b|\bgithub_pat_[A-Za-z0-9_]{24,}\b/
  },
  {
    name: "Linear API key",
    pattern: /\blin_api_[A-Za-z0-9_-]{24,}\b/
  },
  {
    name: "Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/
  },
  {
    name: "AWS access key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/
  },
  {
    name: "secret assignment",
    pattern: /\b(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|GH_TOKEN|LINEAR_API_KEY|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN)\s*=\s*["']?(?!<|your-|example|placeholder|redacted|xxxx|test\b)[A-Za-z0-9_./+=:-]{16,}/i
  }
];
