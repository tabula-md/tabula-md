import { defineConfig, devices } from "@playwright/test";

const externalUrl = process.env.TABULA_TEST_URL?.replace(/\/$/, "");
const localUrl = "http://127.0.0.1:5187";

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
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: externalUrl
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 5187",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: localUrl,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
