import { expect, test } from "@playwright/test";
import {
  createSmokeContext,
  smokeConfig,
} from "../../../scripts/browser-smoke/support/runtime.mjs";

export const registerCapabilityScenarios = (
  suite,
  { scenarioNames = suite.scenarios, tag, timeout } = {},
) => {
  const requestedScenarios = new Set(scenarioNames);
  const unknownScenarios = scenarioNames.filter((name) => !suite.scenarios.includes(name));
  if (unknownScenarios.length > 0) {
    throw new Error(
      `Unknown ${suite.id} scenario(s): ${unknownScenarios.join(", ")}`,
    );
  }

  test.describe(suite.description, () => {
    suite.scenarios.forEach((name, scenarioIndex) => {
      if (!requestedScenarios.has(name)) return;
      const details = tag ? { tag } : {};
      test(name, details, async ({ browser, page }) => {
        if (timeout) {
          test.setTimeout(timeout);
        }
        let currentScenarioIndex = 0;
        let scenarioRan = false;
        const context = createSmokeContext(browser, {
          withPage: async (_browser, path, callback, options = {}) => {
            const matchesRequestedScenario = currentScenarioIndex === scenarioIndex;
            currentScenarioIndex += 1;
            if (!matchesRequestedScenario) return;

            if (options.viewport) {
              await page.setViewportSize(options.viewport);
            }
            if (options.initScript) {
              await page.addInitScript(options.initScript);
            }
            await page.goto(path);
            await page.waitForSelector(".tabbar");
            await callback(page);
            scenarioRan = true;
          },
        });

        await suite.run(context);

        expect(
          scenarioRan,
          `Scenario ${scenarioIndex + 1} was not registered by ${suite.id}.`,
        ).toBe(true);
      });
    });
  });
};

export const registerCapabilitySuite = (
  suite,
  { name, tag, timeout } = {},
) => {
  const details = tag ? { tag } : {};
  test(name ?? suite.description, details, async ({ browser }) => {
    if (timeout) {
      test.setTimeout(timeout);
    }
    await suite.run(createSmokeContext(browser, {
      // Playwright owns these web-server processes. Mark the app as externally
      // managed so legacy service scenarios do not try to stop that lifecycle.
      externalUrl: smokeConfig.externalUrl ?? smokeConfig.baseUrl,
      jsonUrl: smokeConfig.jsonUrl,
    }));
  });
};
