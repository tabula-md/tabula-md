import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const port = Number(process.env.TABULA_TEST_PORT ?? 5187);
const roomPort = Number(process.env.TABULA_TEST_ROOM_PORT ?? 3002);
const externalUrl = process.env.TABULA_TEST_URL;
const baseUrl = externalUrl ?? `http://127.0.0.1:${port}`;
const roomUrl = (process.env.VITE_TABULA_ROOM_URL ?? `http://127.0.0.1:${roomPort}`).replace(/\/$/, "");
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
  const attempts = [{}, { channel: "chrome" }, { channel: "msedge" }];
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
      const modeIcon = item.querySelector(".tab-mode-icon");
      return {
        title: item.getAttribute("data-file-name") ?? item.querySelector(".tab-title")?.textContent?.trim() ?? "",
        visibleTitle: item.querySelector(".tab-title")?.textContent?.trim() ?? "",
        active: item.classList.contains("active"),
        live: item.classList.contains("live"),
        mode: modeIcon?.getAttribute("title") ?? "",
        buttonTitle: button?.getAttribute("title") ?? "",
      };
    }),
  );

const getViewModeActionLabels = async (page) =>
  page.$$eval(".file-toolbar [data-view-mode-action]", (buttons) =>
    buttons.map((button) => button.getAttribute("aria-label") ?? button.getAttribute("title") ?? ""),
  );

const getViewModeSlots = async (page) =>
  page.$$eval(".file-toolbar [data-view-mode-slot]", (items) =>
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

const focusMarkdownEditor = async (page) => {
  await page.locator(".cm-content").focus();
};

const openProjectMenu = async (page) => {
  if ((await page.locator(".left-sidebar").count()) === 0) {
    await page.getByRole("button", { name: "Open Project Menu", exact: true }).click();
    await page.waitForTimeout(120);
  }
};

const openProjectContext = async (page) => {
  if ((await page.locator(".right-panel").count()) === 0) {
    await page.getByRole("button", { name: "Open Project Context", exact: true }).click();
    await page.waitForTimeout(120);
  }
};

const closeProjectContext = async (page) => {
  if ((await page.locator(".right-panel").count()) > 0) {
    await page.getByRole("button", { name: "Close Project Context", exact: true }).click();
    await page.waitForTimeout(120);
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
    return suites;
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

const createSmokeContext = (browser) => ({
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
  waitForText,
  withPage: createWithPage(),
});

const startLocalServers = async () => {
  const roomRepoDir = process.env.TABULA_ROOM_REPO_DIR ?? path.resolve(process.cwd(), "../tabula-room");
  const roomCommand = process.env.TABULA_ROOM_SERVER_COMMAND;
  const roomServer = roomCommand
    ? spawn(roomCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(roomPort),
          TABULA_ROOM_ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
          TABULA_ROOM_DATA_DIR: path.join(process.cwd(), ".tabula-room-smoke"),
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
            TABULA_ROOM_DATA_DIR: path.join(process.cwd(), ".tabula-room-smoke"),
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

  const webServer = spawn(
    isWindows ? "npm.cmd" : "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BROWSER: "none",
        VITE_TABULA_ROOM_URL: roomUrl,
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

  return { roomServer, webServer };
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
};

export async function runBrowserSmoke(suites) {
  const selectedSuites = selectSuites(suites);
  let webServer;
  let roomServer;
  let browser;

  try {
    if (!externalUrl) {
      ({ webServer, roomServer } = await startLocalServers());
    }

    browser = await launchBrowser();
    const context = createSmokeContext(browser);

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
  }
}
