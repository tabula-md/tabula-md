const browserUiPatterns = [
  /^apps\/web\/src\/App\.tsx$/,
  /^apps\/web\/src\/components\//,
  /^apps\/web\/src\/hooks\/useMarkdownFiles\.ts$/,
  /^apps\/web\/src\/keyboardShortcuts\.ts$/,
  /^apps\/web\/src\/styles\//,
  /^scripts\/browser-smoke\//
];

const allBrowserSuites = ["workspace", "editor-preview", "layout", "panels", "collaboration"];

const browserSuitePatterns = {
  workspace: [
    /^apps\/web\/src\/App\.tsx$/,
    /^apps\/web\/src\/components\/EmptyFileState\.tsx$/,
    /^apps\/web\/src\/components\/ShareControls\.tsx$/,
    /^apps\/web\/src\/workspaceStorage\.ts$/,
    /^apps\/web\/src\/publish\.ts$/,
    /^scripts\/browser-smoke\/suites\/workspace\.mjs$/
  ],
  "editor-preview": [
    /^apps\/web\/src\/commentAnchors\.ts$/,
    /^apps\/web\/src\/components\/FileToolbar\.tsx$/,
    /^apps\/web\/src\/components\/MarkdownEditor\.tsx$/,
    /^apps\/web\/src\/components\/MarkdownFormattingToolbar\.tsx$/,
    /^apps\/web\/src\/components\/MarkdownPreview\.tsx$/,
    /^apps\/web\/src\/markdown/,
    /^apps\/web\/src\/styles\/file-surface\.css$/,
    /^apps\/web\/src\/styles\/preview\.css$/,
    /^scripts\/browser-smoke\/suites\/editor-preview\.mjs$/
  ],
  layout: [
    /^apps\/web\/src\/components\/FileTabs\.tsx$/,
    /^apps\/web\/src\/components\/LeftSidebar\.tsx$/,
    /^apps\/web\/src\/components\/StatusBar\.tsx$/,
    /^apps\/web\/src\/components\/TopChrome\.tsx$/,
    /^apps\/web\/src\/hooks\/useWorkspaceScrollSync\.ts$/,
    /^apps\/web\/src\/styles\/base\.css$/,
    /^apps\/web\/src\/styles\/file-surface\.css$/,
    /^apps\/web\/src\/styles\/left-sidebar\.css$/,
    /^apps\/web\/src\/styles\/status-bar\.css$/,
    /^apps\/web\/src\/styles\/tabs\.css$/,
    /^apps\/web\/src\/styles\/top-chrome\.css$/,
    /^scripts\/browser-smoke\/suites\/layout\.mjs$/
  ],
  panels: [
    /^apps\/web\/src\/components\/RightPanel/,
    /^apps\/web\/src\/components\/right-panel\//,
    /^apps\/web\/src\/hooks\/useFileComments\.ts$/,
    /^apps\/web\/src\/hooks\/useRightPanelCollapseState\.ts$/,
    /^apps\/web\/src\/rightPanelCommentViewModel\.ts$/,
    /^apps\/web\/src\/styles\/right-panel/,
    /^scripts\/browser-smoke\/suites\/panels\.mjs$/
  ],
  collaboration: [
    /^apps\/collab-server\//,
    /^apps\/web\/src\/collab\.ts$/,
    /^apps\/web\/src\/hooks\/useCollaborationRoom\.ts$/,
    /^packages\/collab-protocol\//,
    /^scripts\/browser-smoke\/suites\/collaboration\.mjs$/
  ]
};

const browserSmokeSharedPatterns = [
  /^scripts\/browser-smoke\.mjs$/,
  /^scripts\/browser-smoke\/support\//,
  /^scripts\/browser-smoke\/suites\/index\.mjs$/
];

const unitTestPatterns = [
  /^apps\/web\/src\/markdown/,
  /^apps\/web\/src\/agentExports\.ts$/,
  /^apps\/web\/src\/rightPanelCommentViewModel\.ts$/,
  /^packages\//
];

const buildPatterns = [
  /^apps\/.*\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/,
  /^packages\/.*\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/,
  /^vite\.config\.ts$/,
  /^tsconfig\.json$/,
  /^package(?:-lock)?\.json$/
];

export function parsePatchFiles(patchText) {
  const files = new Set();
  const pattern = /^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm;

  for (const match of String(patchText ?? "").matchAll(pattern)) {
    const filePath = normalizeFilePath(match[1] || match[2]);
    if (filePath) {
      files.add(filePath);
    }
  }

  return [...files];
}

export function classifyChangedFiles(files) {
  const normalizedFiles = [...new Set(files.map(normalizeFilePath).filter(Boolean))];
  const browserSuites = new Set();
  const needs = {
    build: false,
    browser: false,
    unit: false,
    hooks: false
  };

  for (const file of normalizedFiles) {
    if (buildPatterns.some((pattern) => pattern.test(file))) {
      needs.build = true;
    }

    if (browserUiPatterns.some((pattern) => pattern.test(file))) {
      needs.browser = true;
    }

    for (const suite of browserSuitesForFile(file)) {
      needs.browser = true;
      browserSuites.add(suite);
    }

    if (unitTestPatterns.some((pattern) => pattern.test(file)) && !file.endsWith(".test.ts")) {
      needs.unit = true;
    }

    if (file.startsWith(".codex/hooks/") || file === ".codex/hooks.json" || file === "scripts/test-codex-hooks.mjs") {
      needs.hooks = true;
    }
  }

  return {
    files: normalizedFiles,
    browserSuites: [...browserSuites],
    needs
  };
}

export function classifyValidationCommand(command) {
  const normalized = String(command ?? "").replace(/\s+/g, " ").trim();
  const browserSuites = classifyBrowserSuitesFromCommand(normalized);
  const observed = {
    build: false,
    browser: false,
    browserSuites,
    unit: false,
    hooks: false
  };

  if (/\bnpm\s+run\s+build\b/.test(normalized)) {
    observed.build = true;
  }

  if (/\bnpm\s+run\s+test:browser(?::[\w-]+)?\b/.test(normalized) || /\bnode\s+scripts\/browser-smoke\.mjs\b/.test(normalized)) {
    observed.browser = true;
  }

  if (/\bnpm\s+test\b/.test(normalized) || /\bnpm\s+run\s+test(?:\s|$)/.test(normalized) || /\bvitest\b/.test(normalized)) {
    observed.unit = true;
  }

  if (/\bnpm\s+run\s+test:hooks\b/.test(normalized) || /\bnode\s+scripts\/test-codex-hooks\.mjs\b/.test(normalized)) {
    observed.hooks = true;
  }

  return observed;
}

export function recordChangedFiles(state, files, timestamp = new Date().toISOString()) {
  const classified = classifyChangedFiles(files);
  const next = normalizeState(state);

  for (const file of classified.files) {
    next.changedFiles[file] = timestamp;
  }

  for (const [key, needed] of Object.entries(classified.needs)) {
    if (needed) {
      next.required[key] = timestamp;
    }
  }

  for (const suite of classified.browserSuites) {
    next.requiredBrowserSuites[suite] = timestamp;
  }

  next.updatedAt = timestamp;
  return next;
}

export function recordValidationCommand(state, command, timestamp = new Date().toISOString()) {
  const observed = classifyValidationCommand(command);
  const next = normalizeState(state);

  for (const [key, wasObserved] of Object.entries(observed)) {
    if (key === "browserSuites") {
      continue;
    }

    if (wasObserved && key === "browser") {
      if (observed.browserSuites.includes("all")) {
        next.observed.browser = timestamp;
      }
      for (const suite of observed.browserSuites.filter((suite) => suite !== "all")) {
        next.observedBrowserSuites[suite] = timestamp;
      }
      continue;
    }

    if (wasObserved) {
      next.observed[key] = timestamp;
    }
  }

  next.updatedAt = timestamp;
  return next;
}

export function shouldRecordGitStatusAfterCommand(command) {
  const normalized = String(command ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return false;
  }

  return [
    /\bnpm\s+(?:install|update|dedupe)\b/,
    /\bnpm\s+pkg\s+set\b/,
    /\bnpm\s+run\s+format\b/,
    /\bnpm\s+run\s+lint\b[\s\S]*\s--fix(?:\s|$)/,
    /\bprettier\b[\s\S]*\s--write(?:\s|$)/,
    /\beslint\b[\s\S]*\s--fix(?:\s|$)/,
    /\b(?:node|python3?|ruby|perl)\b[\s\S]*(?:writeFileSync|writeFile|write_text|open\s*\([^)]*,\s*["']w|Path\s*\([^)]*\)\.write_text)/,
    /(?:^|[\s;|&])(?:cat|printf|echo)[\s\S]*?(?:>{1,2})\s*[^\s;&|]+/,
    /(?:^|[\s;|&])tee\s+(?:-[a-zA-Z]+\s+)*[^\s;&|]+/
  ].some((pattern) => pattern.test(normalized));
}

export function getMissingValidations(state) {
  const normalized = normalizeState(state);
  const missing = [];

  for (const [key, requiredAt] of Object.entries(normalized.required)) {
    if (key === "browser") {
      const browserMissing = getMissingBrowserValidation(normalized, requiredAt);
      if (browserMissing) {
        missing.push(browserMissing);
      }
      continue;
    }

    const observedAt = normalized.observed[key];
    if (!observedAt || observedAt < requiredAt) {
      missing.push({
        key,
        requiredAt,
        command: validationCommands[key],
        reason: validationReasons[key]
      });
    }
  }

  return missing;
}

export function parseGitStatusFiles(statusText) {
  const files = new Set();

  for (const line of String(statusText ?? "").split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const entry = line.slice(3).trim();
    if (!entry) {
      continue;
    }

    const filePath = normalizeFilePath(entry.includes(" -> ") ? entry.split(" -> ").at(-1) : entry);
    if (filePath) {
      files.add(filePath);
    }
  }

  return [...files];
}

export function normalizeState(state) {
  return {
    ...(isPlainObject(state) ? state : {}),
    changedFiles: isPlainObject(state?.changedFiles) ? state.changedFiles : {},
    required: isPlainObject(state?.required) ? state.required : {},
    requiredBrowserSuites: isPlainObject(state?.requiredBrowserSuites) ? state.requiredBrowserSuites : {},
    observed: isPlainObject(state?.observed) ? state.observed : {},
    observedBrowserSuites: isPlainObject(state?.observedBrowserSuites) ? state.observedBrowserSuites : {},
    updatedAt: typeof state?.updatedAt === "string" ? state.updatedAt : null
  };
}

function browserSuitesForFile(file) {
  if (browserSmokeSharedPatterns.some((pattern) => pattern.test(file))) {
    return allBrowserSuites;
  }

  return Object.entries(browserSuitePatterns)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(file)))
    .map(([suite]) => suite);
}

function classifyBrowserSuitesFromCommand(command) {
  const suite = command.match(/(?:^|\s)(?:TABULA_BROWSER_SMOKE_SUITE|TABULA_BROWSER_SMOKE_SUITES)=([a-zA-Z0-9_,-]+)/)?.[1]
    ?? command.match(/--suite[=\s]([a-zA-Z0-9_-]+)/)?.[1]
    ?? command.match(/\bnpm\s+run\s+test:browser:([a-zA-Z0-9_-]+)\b/)?.[1];

  if (!suite && /\bnpm\s+run\s+test:browser\b/.test(command) && !/\bnpm\s+run\s+test:browser:/.test(command)) {
    return ["all"];
  }

  if (!suite && /\bnode\s+scripts\/browser-smoke\.mjs\b/.test(command) && !/--suite\b/.test(command)) {
    return ["all"];
  }

  if (!suite) {
    return [];
  }

  return suite
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeBrowserSuiteAlias)
    .filter((value, index, values) => value && values.indexOf(value) === index);
}

function normalizeBrowserSuiteAlias(suite) {
  const aliases = {
    collab: "collaboration",
    editor: "editor-preview",
    preview: "editor-preview"
  };

  return aliases[suite] ?? suite;
}

function getMissingBrowserValidation(state, requiredAt) {
  if (state.observed.browser && state.observed.browser >= requiredAt) {
    return null;
  }

  const requiredSuites = Object.keys(state.requiredBrowserSuites);

  if (requiredSuites.length === 0) {
    return {
      key: "browser",
      requiredAt,
      command: validationCommands.browser,
      reason: validationReasons.browser
    };
  }

  const missingSuites = requiredSuites.filter((suite) => {
    const observedAt = state.observedBrowserSuites[suite];
    const suiteRequiredAt = state.requiredBrowserSuites[suite];
    const fullObservedAt = state.observed.browser;
    return (!fullObservedAt || fullObservedAt < suiteRequiredAt) && (!observedAt || observedAt < suiteRequiredAt);
  });

  if (missingSuites.length === 0) {
    return null;
  }

  return {
    key: "browser",
    requiredAt,
    command: recommendedBrowserCommand(missingSuites),
    reason: `${validationReasons.browser} Missing suite: ${missingSuites.join(", ")}.`
  };
}

function recommendedBrowserCommand(suites) {
  if (suites.length === 1) {
    const alias = suites[0] === "editor-preview" ? "editor" : suites[0] === "collaboration" ? "collab" : suites[0];
    return `npm run test:browser:${alias}`;
  }

  if (suites.length <= 2) {
    return suites.map((suite) => recommendedBrowserCommand([suite])).join(" && ");
  }

  return validationCommands.browser;
}

function normalizeFilePath(filePath) {
  return String(filePath ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^\.\/+/, "");
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

const validationCommands = {
  build: "npm run build",
  browser: "npm run test:browser",
  unit: "npm test",
  hooks: "npm run test:hooks"
};

const validationReasons = {
  build: "TypeScript, import, package, or app wiring changed.",
  browser: "Editor, preview, panel, file tree, share, collaboration, or browser-smoke UI coverage changed.",
  unit: "Pure Markdown/comment/storage-style logic changed.",
  hooks: "Agent hook policy or hook tests changed."
};
