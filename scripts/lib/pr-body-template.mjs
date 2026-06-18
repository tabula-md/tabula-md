import { formatAgentSection, parseAgentSection } from "./agent-context.mjs";

export function validatePrBodyOptions(bodyOptions) {
  const missing = [];

  for (const [label, values] of [
    ["--summary", bodyOptions.summary],
    ["--review-focus", bodyOptions.reviewFocus],
    ["--implementation-notes", bodyOptions.implementationNotes],
    ["--risk", bodyOptions.risk],
    ["--evidence", bodyOptions.evidence]
  ]) {
    if (!hasMeaningfulItems(values)) {
      missing.push(label);
    }
  }

  if (!hasMeaningfulItems([
    ...bodyOptions.validationAutomated,
    ...bodyOptions.validationManual,
    ...bodyOptions.validationNotRun
  ])) {
    missing.push("--validation-automated/--validation-manual/--validation-not-run");
  }

  if (missing.length > 0) {
    throw new Error(`PR body requires meaningful content for: ${missing.join(", ")}.`);
  }
}

export function renderPrBody(bodyOptions, existingBody) {
  const agent = parseAgentSection(existingBody);
  const sections = [
    renderSection("Summary", bodyOptions.summary),
    renderSection("Review Focus", bodyOptions.reviewFocus),
    renderSection("Implementation Notes", bodyOptions.implementationNotes)
  ];

  if (agent.present) {
    sections.push(formatAgentSection({
      tool: agent.tool || "Unknown",
      session: agent.session || "Unknown"
    }));
  }

  sections.push(
    renderValidationSection(bodyOptions),
    renderSection("Risk", bodyOptions.risk),
    renderSection("Evidence", bodyOptions.evidence)
  );

  return `${sections.join("\n\n")}\n`;
}

export function normalizeItems(items) {
  return items
    .flatMap((item) => String(item ?? "").split(/\n+/))
    .map((item) => item.trim())
    .filter((item) => item && item !== "-");
}

export function hasMeaningfulItems(items) {
  return normalizeItems(items).length > 0;
}

function renderSection(title, items) {
  return [`## ${title}`, "", ...formatItems(items)].join("\n");
}

function renderValidationSection(bodyOptions) {
  return [
    "## Validation",
    "",
    renderValidationGroup("Automated", bodyOptions.validationAutomated),
    renderValidationGroup("Manual", bodyOptions.validationManual),
    renderValidationGroup("Not run", bodyOptions.validationNotRun)
  ].join("\n");
}

function renderValidationGroup(label, items) {
  const values = normalizeItems(items);
  if (values.length === 0) {
    return `- ${label}: None.`;
  }

  if (values.length === 1) {
    return `- ${label}: ${values[0]}`;
  }

  return [`- ${label}:`, ...values.map((item) => `  - ${item}`)].join("\n");
}

function formatItems(items) {
  return normalizeItems(items).map((item) => `- ${item}`);
}
