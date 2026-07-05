import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const port = Number(process.env.TABULA_TEST_PORT ?? 5187);
const roomPort = Number(process.env.TABULA_TEST_ROOM_PORT ?? 3002);
const publishPort = Number(process.env.TABULA_TEST_PUBLISH_PORT ?? 3003);
const jsonPort = Number(process.env.TABULA_TEST_JSON_PORT ?? 3004);
const externalUrl = process.env.TABULA_TEST_URL;
const baseUrl = externalUrl ?? `http://127.0.0.1:${port}`;
const roomUrl = (process.env.VITE_TABULA_ROOM_URL ?? `http://127.0.0.1:${roomPort}`).replace(/\/$/, "");
const publishUrl = (process.env.VITE_TABULA_PUBLISH_URL ?? `http://127.0.0.1:${publishPort}`).replace(/\/$/, "");
const jsonUrl = (process.env.VITE_TABULA_JSON_URL ?? `http://127.0.0.1:${jsonPort}`).replace(/\/$/, "");
const publishDataDir = process.env.TABULA_PUBLISH_DATA_DIR ?? path.join(process.cwd(), ".tabula-publish-smoke");
const jsonDataDir = process.env.TABULA_JSON_DATA_DIR ?? path.join(process.cwd(), ".tabula-json-smoke");
const appServerMode = process.env.TABULA_TEST_APP_MODE ?? "dev";
const isWindows = process.platform === "win32";
const primaryShortcutKey = process.platform === "darwin" ? "Meta" : "Control";
const appNewFileShortcut = `${primaryShortcutKey}+Alt+N`;

const expect = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const waitForServer = async (url) => {
  const deadline = Date.now() + 20_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : ""}`);
};

const launchBrowser = async () => {
  const launchOptions = {
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  };
  const attempts = [{ ...launchOptions, channel: "chrome" }, launchOptions, { ...launchOptions, channel: "msedge" }];
  let lastError;

  for (const attempt of attempts) {
    try {
      return await chromium.launch({ ...attempt, headless: true });
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Could not launch a Playwright browser. Run "npx playwright install chromium" if needed.\n${lastError?.message ?? ""}`,
  );
};

const getTabs = async (page) =>
  page.$$eval(".tab-item", (items) =>
    items.map((item) => {
      const button = item.querySelector(".tab-select-button");
      const rawMode = item.getAttribute("data-view-mode") ?? "";
      const mode = rawMode ? `${rawMode.slice(0, 1).toUpperCase()}${rawMode.slice(1)}` : "";
      return {
        title: item.getAttribute("data-file-name") ?? item.querySelector(".tab-title")?.textContent?.trim() ?? "",
        visibleTitle: item.querySelector(".tab-title")?.textContent?.trim() ?? "",
        active: item.classList.contains("active"),
        live: item.classList.contains("live"),
        mode,
        buttonTitle: button?.getAttribute("title") ?? "",
      };
    }),
  );

const getViewModeActionLabels = async (page) =>
  page.$$eval(".document-controls [data-view-mode-action]", (buttons) =>
    buttons.map((button) => button.getAttribute("aria-label") ?? button.getAttribute("title") ?? ""),
  );

const getViewModeSlots = async (page) =>
  page.$$eval(".document-controls [data-view-mode-slot]", (items) =>
    items.map((item) => ({
      slot: item.getAttribute("data-view-mode-slot") ?? "",
      label: item.getAttribute("aria-label") ?? "",
      action: item.getAttribute("data-view-mode-action") ?? "",
      active: item.getAttribute("aria-pressed") === "true",
    })),
  );

const createWithPage =
  () =>
  async (browser, path, callback, options = {}) => {
    const context = await browser.newContext({ viewport: options.viewport ?? { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${path}`);
    await page.waitForSelector(".tabbar");

    try {
      await callback(page);
    } finally {
      await context.close();
    }
  };

const waitForText = async (locator, text, timeout = 8_000) => {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if ((await locator.textContent())?.includes(text)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for text: ${text}`);
};

const waitForEditorReady = async (page, { mode } = {}) => {
  await page.waitForFunction(
    ({ mode }) => {
      const shell = document.querySelector(".file-shell");
      const editor = document.querySelector(".cm-content");
      const editorSurface = document.querySelector(".editor-surface");
      const previewSurface = document.querySelector(".preview-surface");

      if (!shell) {
        return false;
      }

      if (mode && !shell.classList.contains(`view-${mode}`)) {
        return false;
      }

      if (mode === "preview") {
        return Boolean(previewSurface);
      }

      if (mode === "split") {
        return Boolean(editor && editorSurface && previewSurface && editor.getClientRects().length > 0);
      }

      return Boolean(editor && editorSurface && editor.getClientRects().length > 0);
    },
    { mode },
  );
};

const waitForSavedLocally = async (page) => {
  await page.waitForFunction(() => document.querySelector(".status-save-state")?.textContent?.includes("Saved locally"));
};

const waitForSelectionLayer = async (page, { minSegments = 1, popoverVisible } = {}) => {
  await page.waitForFunction(
    ({ minSegments, popoverVisible }) => {
      const surface = document.querySelector(".editor-surface");
      const segmentCount = document.querySelectorAll(".cm-user-selection-segment").length;
      const popover = document.querySelector(".selection-comment-popover");
      const hasPopoverState = popoverVisible === undefined || Boolean(popover) === popoverVisible;
      return surface?.classList.contains("has-text-selection") && segmentCount >= minSegments && hasPopoverState;
    },
    { minSegments, popoverVisible },
  );
};

const waitForShareDialogState = async (page, { open = true, panel, text } = {}) => {
  if (!open) {
    await page.locator(".share-modal").waitFor({ state: "detached" });
    return;
  }

  await page.locator(".share-modal").waitFor({ state: "visible" });

  if (panel) {
    await page.waitForFunction(
      ({ panel }) =>
        Array.from(document.querySelectorAll(".share-modal-tabs [role='tab']")).some(
          (tab) => tab.getAttribute("aria-selected") === "true" && tab.textContent?.trim() === panel,
        ),
      { panel },
    );
  }

  if (text) {
    await page.waitForFunction(
      ({ text }) => document.querySelector(".share-modal")?.textContent?.includes(text),
      { text },
    );
  }
};

const waitForPanelTab = async (page, label) => {
  await page.locator(".right-panel").waitFor({ state: "visible" });
  await page.waitForFunction(
    ({ label }) => document.querySelector(".right-panel-tab.active")?.getAttribute("aria-label") === label,
    { label },
  );
};

const waitForWorkspaceMenuState = async (page, open = true) => {
  await page.locator(".workspace-menu-popover").waitFor({ state: open ? "visible" : "detached" });
};

const waitForProjectContextState = async (page, open = true) => {
  await page.locator(".right-panel").waitFor({ state: open ? "visible" : "detached" });
};

const waitForActiveTab = async (page, matcher) => {
  await page.waitForFunction(
    ({ matcher }) => {
      const activeTab = document.querySelector(".tab-item.active");
      if (!activeTab) {
        return false;
      }

      const title = activeTab.getAttribute("data-file-name") ?? "";
      if (!matcher) {
        return true;
      }

      if (matcher.exact) {
        return title === matcher.exact;
      }

      if (matcher.startsWith) {
        return title.startsWith(matcher.startsWith);
      }

      return true;
    },
    { matcher },
  );
};

const waitForFileCount = async (page, count) => {
  await page.waitForFunction(
    ({ count }) => document.querySelectorAll(".tab-item").length === count,
    { count },
  );
};

const waitForRenderFrame = async (page) => {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
      }),
  );
};

const focusMarkdownEditor = async (page) => {
  await page.locator(".cm-content").focus();
};

const openProjectMenu = async (page) => {
  if ((await page.locator(".workspace-menu-popover").count()) === 0) {
    await page.getByRole("button", { name: "Open Workspace menu", exact: true }).click();
    await waitForWorkspaceMenuState(page, true);
  }
};

const openProjectContext = async (page) => {
  if ((await page.locator(".right-panel").count()) === 0) {
    await page.getByRole("button", { name: "Open Project Context", exact: true }).click();
    await waitForProjectContextState(page, true);
  }
};

const closeProjectContext = async (page) => {
  if ((await page.locator(".right-panel").count()) > 0) {
    await page.getByRole("button", { name: "Close Project Context", exact: true }).click();
    await waitForProjectContextState(page, false);
  }
};

const getRequestedSuites = () => {
  const cliSuiteArg = process.argv.find((arg) => arg.startsWith("--suite="));
  const rawSuites =
    process.env.TABULA_BROWSER_SMOKE_SUITE ??
    process.env.TABULA_BROWSER_SMOKE_SUITES ??
    cliSuiteArg?.slice("--suite=".length) ??
    "";

  return rawSuites
    .split(",")
    .map((suite) => suite.trim())
    .filter(Boolean);
};

const selectSuites = (suites) => {
  const requestedSuites = getRequestedSuites();
  if (requestedSuites.length === 0 || requestedSuites.includes("all")) {
    return suites.filter((suite) => !suite.hiddenFeature);
  }

  const knownSuiteIds = new Set(suites.map((suite) => suite.id));
  const unknownSuites = requestedSuites.filter((suiteId) => !knownSuiteIds.has(suiteId));
  if (unknownSuites.length > 0) {
    throw new Error(
      `Unknown browser smoke suite(s): ${unknownSuites.join(", ")}. Known suites: ${[...knownSuiteIds].join(", ")}`,
    );
  }

  return suites.filter((suite) => requestedSuites.includes(suite.id));
};

const createSmokeContext = (browser, controls = {}) => ({
  appNewFileShortcut,
  baseUrl,
  browser,
  expect,
  externalUrl,
  focusMarkdownEditor,
  getTabs,
  getViewModeActionLabels,
  getViewModeSlots,
  openProjectContext,
  closeProjectContext,
  openProjectMenu,
  publishDataDir,
  publishUrl: controls.publishUrl,
  jsonDataDir,
  jsonUrl: controls.jsonUrl,
  restartRoomServer: controls.restartRoomServer,
  roomUrl,
  startRoomServer: controls.startRoomServer,
  stopRoomServer: controls.stopRoomServer,
  waitForActiveTab,
  waitForEditorReady,
  waitForFileCount,
  waitForPanelTab,
  waitForProjectContextState,
  waitForRenderFrame,
  waitForSavedLocally,
  waitForSelectionLayer,
  waitForShareDialogState,
  waitForText,
  waitForWorkspaceMenuState,
  withPage: createWithPage(),
});

const spawnRoomServer = async () => {
  const roomRepoDir = process.env.TABULA_ROOM_REPO_DIR ?? path.resolve(process.cwd(), "../tabula-room");
  const roomCommand = process.env.TABULA_ROOM_SERVER_COMMAND;
  const roomServer = roomCommand
    ? spawn(roomCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(roomPort),
          TABULA_ROOM_ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
          TABULA_ROOM_MAX_PAYLOAD_BYTES: process.env.TABULA_ROOM_MAX_PAYLOAD_BYTES ?? String(4 * 1024 * 1024),
        },
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      })
    : fs.existsSync(path.join(roomRepoDir, "package.json"))
      ? spawn(isWindows ? "npm.cmd" : "npm", ["run", "dev"], {
          cwd: roomRepoDir,
          env: {
            ...process.env,
            PORT: String(roomPort),
            TABULA_ROOM_ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
            TABULA_ROOM_MAX_PAYLOAD_BYTES: process.env.TABULA_ROOM_MAX_PAYLOAD_BYTES ?? String(4 * 1024 * 1024),
          },
          stdio: ["ignore", "pipe", "pipe"],
        })
      : null;

  if (roomServer) {
    roomServer.stdout.on("data", () => {});
    roomServer.stderr.on("data", () => {});
    roomServer.on("error", (error) => {
      throw error;
    });
    await waitForServer(`${roomUrl}/health`);
  } else {
    await waitForServer(`${roomUrl}/health`);
  }

  return roomServer;
};

const spawnPublishServer = async () => {
  const publishRepoDir = process.env.TABULA_PUBLISH_REPO_DIR ?? path.resolve(process.cwd(), "../tabula-publish");
  const publishCommand = process.env.TABULA_PUBLISH_SERVER_COMMAND;
  fs.rmSync(publishDataDir, { recursive: true, force: true });
  const publishServer = publishCommand
    ? spawn(publishCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(publishPort),
          TABULA_PUBLISH_ALLOWED_ORIGINS: baseUrl,
          TABULA_PUBLISH_APP_PUBLIC_URL: baseUrl,
          TABULA_PUBLISH_DATA_DIR: publishDataDir,
          TABULA_PUBLISH_PUBLIC_URL: publishUrl,
        },
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      })
    : fs.existsSync(path.join(publishRepoDir, "package.json"))
      ? spawn(isWindows ? "npm.cmd" : "npm", ["run", "dev"], {
          cwd: publishRepoDir,
          env: {
            ...process.env,
            PORT: String(publishPort),
            TABULA_PUBLISH_ALLOWED_ORIGINS: baseUrl,
            TABULA_PUBLISH_APP_PUBLIC_URL: baseUrl,
            TABULA_PUBLISH_DATA_DIR: publishDataDir,
            TABULA_PUBLISH_PUBLIC_URL: publishUrl,
          },
          stdio: ["ignore", "pipe", "pipe"],
        })
      : null;

  if (publishServer) {
    publishServer.stdout.on("data", () => {});
    publishServer.stderr.on("data", () => {});
    publishServer.on("error", (error) => {
      throw error;
    });
    await waitForServer(`${publishUrl}/health`);
  } else {
    await waitForServer(`${publishUrl}/health`);
  }

  return publishServer;
};

const spawnJsonServer = async () => {
  const jsonRepoDir = process.env.TABULA_JSON_REPO_DIR ?? path.resolve(process.cwd(), "../tabula-json");
  const jsonCommand = process.env.TABULA_JSON_SERVER_COMMAND;
  fs.rmSync(jsonDataDir, { recursive: true, force: true });
  const jsonServer = jsonCommand
    ? spawn(jsonCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(jsonPort),
          TABULA_JSON_ALLOWED_ORIGINS: baseUrl,
          TABULA_JSON_DATA_DIR: jsonDataDir,
        },
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      })
    : fs.existsSync(path.join(jsonRepoDir, "package.json"))
      ? spawn(isWindows ? "npm.cmd" : "npm", ["run", "dev"], {
          cwd: jsonRepoDir,
          env: {
            ...process.env,
            PORT: String(jsonPort),
            TABULA_JSON_ALLOWED_ORIGINS: baseUrl,
            TABULA_JSON_DATA_DIR: jsonDataDir,
          },
          stdio: ["ignore", "pipe", "pipe"],
        })
      : null;

  if (jsonServer) {
    jsonServer.stdout.on("data", () => {});
    jsonServer.stderr.on("data", () => {});
    jsonServer.on("error", (error) => {
      throw error;
    });
    await waitForServer(`${jsonUrl}/health`);
  } else {
    await waitForServer(`${jsonUrl}/health`);
  }

  return jsonServer;
};

const startLocalServers = async ({ withPublishServer = false, withJsonServer = false } = {}) => {
  const roomServer = await spawnRoomServer();
  const publishServer = withPublishServer ? await spawnPublishServer() : null;
  const jsonServer = withJsonServer ? await spawnJsonServer() : null;
  const appServerArgs =
    appServerMode === "preview"
      ? ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)]
      : ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)];
  const webServer = spawn(
    isWindows ? "npm.cmd" : "npm",
    appServerArgs,
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BROWSER: "none",
        VITE_TABULA_ROOM_URL: roomUrl,
        ...(withJsonServer ? { VITE_TABULA_JSON_URL: jsonUrl } : {}),
        ...(withPublishServer ? { VITE_TABULA_PLUS_ENABLED: "1", VITE_TABULA_PUBLISH_URL: publishUrl } : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  webServer.stdout.on("data", () => {});
  webServer.stderr.on("data", () => {});
  webServer.on("error", (error) => {
    throw error;
  });
  await waitForServer(baseUrl);

  return { roomServer, webServer, publishServer, jsonServer };
};

const stopProcess = async (childProcess) => {
  if (!childProcess) {
    return;
  }

  childProcess.kill("SIGTERM");
  await Promise.race([once(childProcess, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
};

export const smokeConfig = {
  baseUrl,
  externalUrl,
  port,
  roomPort,
  roomUrl,
  publishPort,
  publishUrl,
  publishDataDir,
  jsonPort,
  jsonUrl,
  jsonDataDir,
};

export async function runBrowserSmoke(suites) {
  const selectedSuites = selectSuites(suites);
  const needsPublishServer = selectedSuites.some((suite) => suite.requiresPublishService);
  const needsJsonServer = selectedSuites.some((suite) => suite.requiresJsonService);
  let webServer;
  let roomServer;
  let publishServer;
  let jsonServer;
  let browser;

  try {
    if (!externalUrl) {
      ({ webServer, roomServer, publishServer, jsonServer } = await startLocalServers({
        withPublishServer: needsPublishServer,
        withJsonServer: needsJsonServer,
      }));
    }

    browser = await launchBrowser();
    const context = createSmokeContext(browser, {
      publishUrl: needsPublishServer ? publishUrl : process.env.VITE_TABULA_PUBLISH_URL?.replace(/\/$/, ""),
      jsonUrl: needsJsonServer ? jsonUrl : process.env.VITE_TABULA_JSON_URL?.replace(/\/$/, ""),
      restartRoomServer: async () => {
        if (!roomServer) {
          throw new Error("Cannot restart an externally managed Tabula Room server.");
        }

        await stopProcess(roomServer);
        roomServer = await spawnRoomServer();
        if (!roomServer) {
          throw new Error("Tabula Room restart did not create a managed server process.");
        }
      },
      startRoomServer: async () => {
        if (roomServer) {
          return;
        }

        roomServer = await spawnRoomServer();
        if (!roomServer) {
          throw new Error("Tabula Room start did not create a managed server process.");
        }
      },
      stopRoomServer: async () => {
        if (!roomServer) {
          throw new Error("Cannot stop an externally managed Tabula Room server.");
        }

        await stopProcess(roomServer);
        roomServer = null;
      },
    });

    for (const suite of selectedSuites) {
      await suite.run(context);
    }

    console.log(`Browser smoke checks passed (${selectedSuites.map((suite) => suite.id).join(", ")}).`);
  } finally {
    if (browser) {
      await browser.close();
    }

    await stopProcess(webServer);
    await stopProcess(roomServer);
    await stopProcess(publishServer);
    await stopProcess(jsonServer);
  }
}
