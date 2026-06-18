import fs from "node:fs";
import { resolveAgentContext, upsertAgentSection } from "./agent-context.mjs";
import {
  addIssueAssignees,
  addIssueLabels,
  gh,
  ghJson,
  requestPullRequestReviewers,
  updatePullRequestBody
} from "./pr-github.mjs";
import { parseList } from "./pr-options.mjs";

export const defaultOwnerLogin = "taehalim";
export const labelCatalog = JSON.parse(fs.readFileSync(new URL("../../.github/labels.json", import.meta.url), "utf8"));

const labelDefinitionsByName = new Map(labelCatalog.map((label) => [label.name, label]));
const labelNamesByLowercase = new Map(labelCatalog.map((label) => [label.name.toLowerCase(), label.name]));

export function buildPrMetadata(options, pullRequest, repo) {
  const labels = options.labels.map(resolveCatalogLabelName);
  const assignees = options.assignees.length > 0
    ? options.assignees
    : parseList(process.env.TABULA_PR_ASSIGNEES || defaultOwnerLogin);
  const reviewerCandidates = options.noReviewers
    ? []
    : options.reviewers.length > 0
      ? options.reviewers
      : parseList(process.env.TABULA_PR_REVIEWERS || defaultOwnerLogin);
  const reviewers = reviewerCandidates.filter((login) => login !== pullRequest.author?.login);
  const skippedReviewers = reviewerCandidates.filter((login) => login === pullRequest.author?.login);
  const agentContext = resolveAgentContext({
    agent: options.agent,
    session: options.session
  });
  const shouldUpdateAgentContext = !options.noAgentContext && hasCompleteAgentContext(agentContext);
  const resolvedLabels = labels.map((label) => ensureGitHubLabel(repo, label, options.dryRun));

  return {
    assignees,
    reviewers,
    skippedReviewers,
    agentContext,
    shouldUpdateAgentContext,
    resolvedLabels
  };
}

export function applyPrMetadata(repo, pullRequest, metadata, { body = pullRequest.body, updateAgentBody = true } = {}) {
  if (metadata.resolvedLabels.length > 0) {
    addIssueLabels(repo, pullRequest.number, metadata.resolvedLabels);
  }

  if (metadata.assignees.length > 0) {
    addIssueAssignees(repo, pullRequest.number, metadata.assignees);
  }

  if (metadata.reviewers.length > 0) {
    requestPullRequestReviewers(repo, pullRequest.number, metadata.reviewers);
  }

  if (updateAgentBody && metadata.shouldUpdateAgentContext) {
    updatePullRequestBody(repo, pullRequest.number, upsertAgentSection(body, metadata.agentContext));
  }
}

export function bodyWithAgentContext(body, metadata) {
  return metadata.shouldUpdateAgentContext
    ? upsertAgentSection(body, metadata.agentContext)
    : body;
}

export function resolveCatalogLabelName(labelName) {
  const resolved = labelNamesByLowercase.get(String(labelName).toLowerCase());
  if (!resolved) {
    throw new Error(`Unknown PR label: ${labelName}. Run \`npm run pr:metadata -- --list-labels\`.`);
  }
  return resolved;
}

export function printLabelCatalog() {
  console.log("Available Tabula.md PR labels:");
  for (const label of labelCatalog) {
    console.log(`- ${label.name}: ${label.description}`);
  }
}

export function formatAgentOutput(noAgentContext, shouldUpdateAgentContext, context) {
  if (noAgentContext) {
    return "not updated";
  }

  if (shouldUpdateAgentContext) {
    return `${context.tool} / ${context.session}`;
  }

  return `skipped; incomplete context (${context.tool} / ${context.session}). Pass --agent and --session, or set agent context env vars.`;
}

function ensureGitHubLabel(repo, labelName, dryRun) {
  const labels = ghJson(["api", `repos/${repo}/labels?per_page=100`]);
  const exact = labels.find((label) => label.name === labelName);
  if (exact) {
    return exact.name;
  }

  const caseInsensitive = labels.find((label) => label.name.toLowerCase() === labelName.toLowerCase());
  if (caseInsensitive) {
    return caseInsensitive.name;
  }

  const definition = labelDefinitionsByName.get(labelName);

  if (!dryRun) {
    gh([
      "api",
      "--method",
      "POST",
      `repos/${repo}/labels`,
      "-f",
      `name=${labelName}`,
      "-f",
      `color=${definition.color}`,
      "-f",
      `description=${definition.description}`
    ]);
  }

  return labelName;
}

function hasCompleteAgentContext(context) {
  return Boolean(context.tool && context.tool !== "Unknown" && context.session && context.session !== "Unknown");
}
