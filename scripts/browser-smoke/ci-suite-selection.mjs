import fs from "node:fs";

const PLAYWRIGHT = {
  visual: [
    "markdown-parity.spec.mjs",
    "visual-interaction.spec.mjs",
    "editor-controls.spec.mjs",
    "responsive-layout.spec.mjs",
  ],
  preview: [
    "markdown-parity.spec.mjs",
    "preview-navigation.spec.mjs",
    "editor-controls.spec.mjs",
    "responsive-layout.spec.mjs",
  ],
  panels: ["right-panels.spec.mjs"],
  performance: ["performance.spec.mjs"],
  storage: ["storage-restore.spec.mjs"],
  collaboration: ["collaboration-capability.spec.mjs"],
  share: ["share-capability.spec.mjs"],
};

const LEGACY = {
  workspace: ["workspace"],
  editor: [
    "editor-preview-sync",
    "editor-preview-typography",
    "editor-search-layout",
    "editor-search-source",
    "editor-search-replace",
    "editor-search-preview",
    "editor-search-focus-history",
    "editor-selection-comments",
    "split-layout",
  ],
  layout: ["layout"],
  knowledge: ["knowledge-links", "okf-concepts"],
  collaboration: ["collaboration"],
  share: ["json-share"],
};

const PLAYWRIGHT_GROUP_ORDER = [
  "visual",
  "preview",
  "panels",
  "storage",
  "collaboration",
  "share",
  "performance",
];
const FALLBACK_PLAYWRIGHT_GROUPS = [
  "visual",
  "panels",
  "storage",
  "collaboration",
  "share",
];
const FALLBACK_LEGACY_GROUPS = [];
const ROOM_PLAYWRIGHT_GROUPS = new Set([
  "preview",
  "performance",
  "storage",
  "collaboration",
]);
const JSON_PLAYWRIGHT_GROUPS = new Set(["share"]);
const ROOM_LEGACY_SUITES = new Set([
  "workspace",
  "editor-selection-comments",
  "editor-certification",
  "collaboration",
  "collaboration-editor-torture",
  "collaboration-memory",
  "collaboration-lifecycle",
]);
const JSON_LEGACY_SUITES = new Set(["json-share"]);
const FULL_RUN_PATHS = [
  ".github/workflows/browser-smoke.yml",
  "package.json",
  "package-lock.json",
  "playwright.config.ts",
  "vite.config.ts",
  "scripts/browser-smoke.mjs",
  "scripts/browser-smoke/ci-suite-selection.mjs",
];
const LEGACY_SUITE_FILES = new Map([
  ["workspace-menu", "workspace"],
  ["knowledge-links", "knowledge-links"],
  ["okf-concepts", "okf-concepts"],
  ["collaboration", "collaboration"],
  ["collaboration-editor-torture", "collaboration-editor-torture"],
  ["collaboration-memory", "collaboration-memory"],
  ["collaboration-lifecycle", "collaboration-lifecycle"],
  ["json-share", "json-share"],
  ...LEGACY.editor.map((suite) => [suite, suite]),
  ...LEGACY.layout.map((suite) => [suite, suite]),
]);

function isUnitTest(path) {
  return (
    (path.startsWith("tabula-app/src/") || path.startsWith("packages/tabula/src/")) &&
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)
  );
}

function addLegacyGroup(selected, group) {
  for (const suite of LEGACY[group]) selected.add(suite);
}

export function selectBrowserSmokeSuites(changedPaths) {
  const paths = [...new Set(changedPaths.map((path) => path.trim()).filter(Boolean))];
  const playwrightGroups = new Set();
  const legacySuites = new Set();
  const reasons = new Set();
  let fallbackRun = false;

  const addPlaywright = (group, reason) => {
    playwrightGroups.add(group);
    reasons.add(reason);
  };
  const addLegacy = (group, reason) => {
    addLegacyGroup(legacySuites, group);
    reasons.add(reason);
  };
  const selectFallback = (reason) => {
    fallbackRun = true;
    reasons.add(reason);
  };

  for (const path of paths) {
    if (FULL_RUN_PATHS.includes(path)) {
      selectFallback("browser infrastructure changed");
      continue;
    }

    if (isUnitTest(path)) continue;

    if (path.startsWith("tests/browser/") || path.startsWith("scripts/browser-smoke/")) {
      if (
        path.endsWith("/markdown-parity.spec.mjs") ||
        path.endsWith("/visual-interaction.spec.mjs") ||
        path.endsWith("/editor-controls.spec.mjs") ||
        path.endsWith("/responsive-layout.spec.mjs") ||
        path.endsWith("/suites/editor-visual.mjs")
      ) {
        addPlaywright("visual", "visual editor changed");
      } else if (
        path.endsWith("/preview-navigation.spec.mjs") ||
        path.endsWith("/suites/editor-preview.mjs")
      ) {
        addPlaywright("preview", "preview changed");
      } else if (
        path.endsWith("/right-panels.spec.mjs") ||
        path.endsWith("/suites/panels.mjs")
      ) {
        addPlaywright("panels", "panel behavior changed");
      } else if (
        path.endsWith("/performance.spec.mjs") ||
        path.endsWith("/suites/performance.mjs")
      ) {
        addPlaywright("performance", "performance check changed");
      } else if (
        path.endsWith("/storage-restore.spec.mjs") ||
        path.endsWith("/suites/workspace-menu.mjs")
      ) {
        addPlaywright("storage", "storage restore changed");
      } else if (
        path.endsWith("/collaboration-capability.spec.mjs") ||
        path.endsWith("/suites/collaboration.mjs")
      ) {
        addPlaywright("collaboration", "collaboration changed");
      } else if (
        path.endsWith("/share-capability.spec.mjs") ||
        path.endsWith("/suites/json-share.mjs")
      ) {
        addPlaywright("share", "sharing changed");
      } else {
        const suiteFile = path.match(/\/suites\/([^/]+)\.mjs$/)?.[1];
        const legacySuite = suiteFile && LEGACY_SUITE_FILES.get(suiteFile);
        if (legacySuite) {
          legacySuites.add(legacySuite);
          reasons.add(`${legacySuite} check changed`);
        } else if (!path.endsWith("harness.spec.ts")) {
          selectFallback("shared browser test code changed");
        }
      }
      continue;
    }

    if (path.startsWith("tabula-app/src/collaboration/") || path.startsWith("packages/tabula/src/room/")) {
      addPlaywright("collaboration", "collaboration runtime changed");
      continue;
    }

    if (path.startsWith("tabula-app/src/share/")) {
      addPlaywright("collaboration", "sharing changed");
      addPlaywright("share", "sharing changed");
      continue;
    }

    if (
      path.startsWith("tabula-app/src/preview/") ||
      path === "tabula-app/src/document/MarkdownPreview.tsx" ||
      path.startsWith("tabula-app/src/styles/preview") ||
      path.startsWith("packages/tabula/src/markdown/")
    ) {
      addPlaywright("preview", "preview changed");
      addLegacy("editor", "preview changed");
      continue;
    }

    if (
      path.startsWith("tabula-app/src/editor/") ||
      path.startsWith("tabula-app/src/editorExtensions/") ||
      path.startsWith("tabula-app/src/toolbar/") ||
      path === "tabula-app/src/document/MarkdownEditor.tsx" ||
      path === "tabula-app/src/document/FormattingToolbar.tsx" ||
      path.startsWith("tabula-app/src/styles/editor")
    ) {
      addPlaywright("visual", "editor changed");
      addLegacy("editor", "editor changed");
      if (path.includes("workspaceFileSearchModel")) {
        addLegacy("knowledge", "knowledge search changed");
      }
      continue;
    }

    if (
      path.startsWith("tabula-app/src/right-panel/") ||
      path.startsWith("tabula-app/src/styles/right-panel")
    ) {
      addPlaywright("panels", "right panel changed");
      if (/Knowledge|Links|Graph|Okf|knowledge|links|graph|compatibility/.test(path)) {
        addLegacy("knowledge", "knowledge panel changed");
      }
      continue;
    }

    if (path.startsWith("tabula-app/src/comments/")) {
      addPlaywright("panels", "comments changed");
      legacySuites.add("editor-selection-comments");
      reasons.add("comments changed");
      continue;
    }

    if (
      path.startsWith("tabula-app/src/workspace/") ||
      path.startsWith("packages/tabula/src/document/") ||
      path.startsWith("packages/tabula/src/data/")
    ) {
      addPlaywright("storage", "workspace changed");
      if (
        /knowledge|Compatibility|workspaceImportProfile|workspaceExportReview/.test(
          path,
        )
      ) {
        addLegacy("knowledge", "knowledge workspace changed");
      }
      if (
        path.includes("/components/") ||
        path.includes("workspaceAppViewModel") ||
        path.includes("workspaceUiStore")
      ) {
        addPlaywright("panels", "workspace chrome changed");
      }
      continue;
    }

    if (
      path.startsWith("tabula-app/src/document/") ||
      path.startsWith("tabula-app/src/styles/split-view") ||
      path.startsWith("packages/tabula/src/workbench/")
    ) {
      addPlaywright("visual", "document surface changed");
      addPlaywright("preview", "document surface changed");
      addLegacy("editor", "document surface changed");
      addLegacy("layout", "document surface changed");
      continue;
    }

    if (
      path.startsWith("tabula-app/") ||
      path.startsWith("packages/tabula/") ||
      path.startsWith("tabula-room/")
    ) {
      selectFallback("unclassified browser runtime changed");
    }
  }

  if (fallbackRun) {
    for (const group of FALLBACK_PLAYWRIGHT_GROUPS) playwrightGroups.add(group);
    for (const group of FALLBACK_LEGACY_GROUPS) addLegacyGroup(legacySuites, group);
  }

  const playwrightFiles = [
    "harness.spec.ts",
    ...new Set(
      PLAYWRIGHT_GROUP_ORDER
        .filter((group) => playwrightGroups.has(group))
        .flatMap((group) => PLAYWRIGHT[group]),
    ),
  ];
  const legacy = [...legacySuites];
  const needsRoom =
    [...playwrightGroups].some((group) => ROOM_PLAYWRIGHT_GROUPS.has(group)) ||
    legacy.some((suite) => ROOM_LEGACY_SUITES.has(suite));
  const needsJson = legacy.some((suite) => JSON_LEGACY_SUITES.has(suite));
  const needsJsonService =
    [...playwrightGroups].some((group) => JSON_PLAYWRIGHT_GROUPS.has(group)) ||
    needsJson;

  return {
    playwrightFiles,
    legacySuites: legacy,
    needsRoom,
    needsJson: needsJsonService,
    fallbackRun,
    reason: reasons.size > 0 ? [...reasons].join("; ") : "no browser runtime changed",
  };
}

function readChangedPaths() {
  if (process.argv.length > 2) return process.argv.slice(2);
  const input = fs.readFileSync(0, "utf8");
  return input.includes("\0") ? input.split("\0") : input.split(/\r?\n/);
}

function writeGithubOutput(selection) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(
    outputPath,
    [
      `playwright_files=${selection.playwrightFiles.join(" ")}`,
      `legacy_suites=${selection.legacySuites.join(",")}`,
      `needs_room=${selection.needsRoom}`,
      `needs_json=${selection.needsJson}`,
      `fallback_run=${selection.fallbackRun}`,
      `reason=${selection.reason}`,
      "",
    ].join("\n"),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const selection = selectBrowserSmokeSuites(readChangedPaths());
  writeGithubOutput(selection);
  console.log(JSON.stringify(selection, null, 2));
}
