import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const externalUrl = process.env.TABULA_TEST_URL?.replace(/\/$/, "");
const localUrl = "http://127.0.0.1:5187";
const siblingRoomRepoDir = path.resolve(process.cwd(), "../tabula-room");
const roomRepoDir =
  process.env.TABULA_ROOM_REPO_DIR ??
  (fs.existsSync(path.join(siblingRoomRepoDir, "package.json"))
    ? siblingRoomRepoDir
    : undefined);
const siblingJsonRepoDir = path.resolve(process.cwd(), "../tabula-json");
const jsonRepoDir =
  process.env.TABULA_JSON_REPO_DIR ??
  (fs.existsSync(path.join(siblingJsonRepoDir, "package.json"))
    ? siblingJsonRepoDir
    : undefined);
const roomUrl = "http://127.0.0.1:3012";
const jsonUrl = "http://127.0.0.1:3014";
const jsonDataDir = path.resolve(process.cwd(), "output/playwright/json-data");
const localWebServers = [
  ...(roomRepoDir
    ? [
        {
          command: "npm run dev",
          cwd: roomRepoDir,
          env: {
            PORT: "3012",
            TABULA_ROOM_ALLOWED_ORIGINS: localUrl,
            TABULA_ROOM_MAX_PAYLOAD_BYTES: String(4 * 1024 * 1024),
          },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: `${roomUrl}/health`,
        },
      ]
    : []),
  ...(jsonRepoDir
    ? [
        {
          command: "npm run dev",
          cwd: jsonRepoDir,
          env: {
            PORT: "3014",
            TABULA_JSON_ALLOWED_ORIGINS: localUrl,
            TABULA_JSON_DATA_DIR: jsonDataDir,
          },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: `${jsonUrl}/health`,
        },
      ]
    : []),
  {
    command: "npm run dev -- --host 127.0.0.1 --port 5187",
    env: {
      ...(roomRepoDir ? { VITE_TABULA_ROOM_URL: roomUrl } : {}),
      ...(jsonRepoDir ? { VITE_TABULA_JSON_URL: jsonUrl } : {}),
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: localUrl,
  },
];

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "output/playwright/results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { open: "never", outputFolder: "output/playwright/report" }],
      ]
    : "line",
  use: {
    baseURL: externalUrl ?? localUrl,
    launchOptions: {
      args: [
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: externalUrl
    ? undefined
    : localWebServers,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
