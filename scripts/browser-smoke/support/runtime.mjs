import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { chromium } from "playwright";

const port = Number(process.env.TABULA_TEST_PORT ?? 5187);
const roomPort = Number(process.env.TABULA_TEST_ROOM_PORT ?? 3012);
const jsonPort = Number(process.env.TABULA_TEST_JSON_PORT ?? 3014);
const firestorePort = 8080;
const firebaseStoragePort = 9199;
const firebaseStartTimeoutMs = Number(process.env.TABULA_TEST_FIREBASE_START_TIMEOUT_MS ?? 120_000);
const externalUrl = process.env.TABULA_TEST_URL;
const baseUrl = externalUrl ?? `http://127.0.0.1:${port}`;
const roomUrl = (process.env.VITE_TABULA_ROOM_URL ?? `http://127.0.0.1:${roomPort}`).replace(/\/$/, "");
const jsonUrl = (process.env.VITE_TABULA_JSON_URL ?? `http://127.0.0.1:${jsonPort}`).replace(/\/$/, "");
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

const waitForServer = async (url, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
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

const assertPortAvailable = (port) => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", () => reject(new Error(`Browser smoke port ${port} is already in use.`)));
  server.once("listening", () => server.close(resolve));
  server.listen(port, "127.0.0.1");
});

const waitForPort = async (port, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const connected = await new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (connected) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for 127.0.0.1:${port}`);
};

const launchBrowser = async ({ naturalBackgrounding = false } = {}) => {
  const launchOptions = naturalBackgrounding
    ? {}
    : { args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ] };
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
        live: Boolean(item.getAttribute("data-room-id")),
        mode,
        buttonTitle: button?.getAttribute("title") ?? "",
      };
    }),
  );

const getViewModeActionLabels = async (page) =>
  page.$$eval(".document-controls [data-view-mode]", (buttons) =>
    buttons.map((button) => button.getAttribute("aria-label") ?? button.getAttribute("title") ?? ""),
  );

const getViewModeSlots = async (page) =>
  page.$$eval(".document-controls [data-view-mode]", (items) =>
    items.map((item) => ({
      viewMode: item.getAttribute("data-view-mode") ?? "",
      label: item.getAttribute("aria-label") ?? "",
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
  await page.waitForFunction(() => document.querySelector(".status-save-state")?.getAttribute("aria-label") === "Saved locally");
};

const waitForSelectionLayer = async (page, { minSegments = 1, popoverVisible } = {}) => {
  await page.waitForFunction(
    ({ minSegments, popoverVisible }) => {
      const surface = document.querySelector(".editor-surface");
      const segmentCount = document.querySelectorAll(".cm-selectionLayer .cm-selectionBackground").length;
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
      ({ panel }) => {
        const tabs = Array.from(document.querySelectorAll(".share-modal-tabs [role='tab']"));
        if (tabs.length === 0) {
          return panel === "Share link";
        }
        return tabs.some(
          (tab) => tab.getAttribute("aria-selected") === "true" && tab.textContent?.trim() === panel,
        );
      },
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

const ensureSidePanelOpen = async (page) => {
  if ((await page.locator(".right-panel").count()) === 0) {
    await page.getByRole("button", { name: "Toggle side panel", exact: true }).click();
    await waitForProjectContextState(page, true);
  }
};

const openMarkdownFile = async (
  page,
  { name = "README.md", content = "# Tabula.md\n\nA local-first Markdown workspace." } = {},
) => {
  await page.locator('input[aria-label="Open Markdown file"]').setInputFiles({
    name,
    mimeType: "text/markdown",
    buffer: Buffer.from(content),
  });
  await waitForActiveTab(page, { exact: name });
};

const ensureSidePanelClosed = async (page) => {
  if ((await page.locator(".right-panel").count()) > 0) {
    await page.getByRole("button", { name: "Toggle side panel", exact: true }).click();
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
  ensureSidePanelOpen,
  ensureSidePanelClosed,
  openMarkdownFile,
  openProjectMenu,
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
        detached: !isWindows,
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
          detached: !isWindows,
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
        detached: !isWindows,
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
          detached: !isWindows,
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

const spawnFirebaseEmulators = async () => {
  await Promise.all([
    assertPortAvailable(firestorePort),
    assertPortAvailable(firebaseStoragePort),
  ]);
  const firebaseProcess = spawn(
    isWindows ? "npx.cmd" : "npx",
    [
      "--yes",
      "firebase-tools@15.22.4",
      "emulators:start",
      "--only",
      "firestore,storage",
      "--project",
      "tabula-local",
      "--config",
      "scripts/browser-smoke/fixtures/firebase/firebase.json",
    ],
    {
      cwd: process.cwd(),
      detached: !isWindows,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let firebaseOutput = "";
  const captureFirebaseOutput = (chunk) => {
    firebaseOutput = `${firebaseOutput}${chunk}`.slice(-16_000);
  };
  firebaseProcess.stdout.on("data", captureFirebaseOutput);
  firebaseProcess.stderr.on("data", captureFirebaseOutput);
  firebaseProcess.on("error", (error) => {
    throw error;
  });
  await new Promise((resolve, reject) => {
    const handleExit = (code) => {
      const output = firebaseOutput.trim();
      reject(new Error(
        `Firebase emulators exited before becoming ready (code ${code ?? "unknown"}).${output ? `\n${output}` : ""}`,
      ));
    };
    firebaseProcess.once("exit", handleExit);
    Promise.all([
      waitForServer(`http://127.0.0.1:${firestorePort}`, firebaseStartTimeoutMs),
      waitForPort(firebaseStoragePort, firebaseStartTimeoutMs),
    ]).then(
      () => {
        firebaseProcess.off("exit", handleExit);
        resolve();
      },
      async (error) => {
        firebaseProcess.off("exit", handleExit);
        await stopProcess(firebaseProcess, { processGroup: true });
        const output = firebaseOutput.trim();
        reject(new Error(`${error.message}${output ? `\n${output}` : ""}`));
      },
    );
  });
  return firebaseProcess;
};

const startLocalServers = async ({ withJsonServer = false } = {}) => {
  const firebaseProcess = await spawnFirebaseEmulators();
  const roomServer = await spawnRoomServer();
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
      detached: !isWindows,
      env: {
        ...process.env,
        BROWSER: "none",
        VITE_TABULA_FIREBASE_EMULATOR_HOST: "127.0.0.1",
        VITE_TABULA_FIRESTORE_EMULATOR_PORT: String(firestorePort),
        VITE_TABULA_FIREBASE_STORAGE_EMULATOR_PORT: String(firebaseStoragePort),
        VITE_TABULA_ROOM_URL: roomUrl,
        ...(withJsonServer ? { VITE_TABULA_JSON_URL: jsonUrl } : {}),
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

  return { firebaseProcess, roomServer, webServer, jsonServer };
};

const stopProcess = async (childProcess, { processGroup = false } = {}) => {
  if (!childProcess) {
    return;
  }

  if (processGroup && !isWindows && childProcess.pid) {
    try {
      process.kill(-childProcess.pid, "SIGTERM");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  } else {
    childProcess.kill("SIGTERM");
  }
  await Promise.race([once(childProcess, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
};

export const smokeConfig = {
  baseUrl,
  externalUrl,
  port,
  roomPort,
  roomUrl,
  jsonPort,
  jsonUrl,
  jsonDataDir,
};

export async function runBrowserSmoke(suites) {
  const selectedSuites = selectSuites(suites);
  const needsJsonServer = selectedSuites.some((suite) => suite.requiresJsonService);
  let webServer;
  let roomServer;
  let jsonServer;
  let firebaseProcess;
  let browser;

  try {
    if (!externalUrl) {
      ({ firebaseProcess, webServer, roomServer, jsonServer } = await startLocalServers({
        withJsonServer: needsJsonServer,
      }));
    }

    browser = await launchBrowser({
      naturalBackgrounding: selectedSuites.some((suite) => suite.requiresNaturalBackgrounding),
    });
    const context = createSmokeContext(browser, {
      jsonUrl: needsJsonServer ? jsonUrl : process.env.VITE_TABULA_JSON_URL?.replace(/\/$/, ""),
      restartRoomServer: async () => {
        if (!roomServer) {
          throw new Error("Cannot restart an externally managed Tabula Room server.");
        }

        await stopProcess(roomServer, { processGroup: true });
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

        await stopProcess(roomServer, { processGroup: true });
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

    await stopProcess(webServer, { processGroup: true });
    await stopProcess(roomServer, { processGroup: true });
    await stopProcess(jsonServer, { processGroup: true });
    await stopProcess(firebaseProcess, { processGroup: true });
  }
}
