import { expect, test } from "@playwright/test";
import { createSmokeContext } from "../../../scripts/browser-smoke/support/runtime.mjs";

export const registerLegacySmokeScenarios = (suite) => {
  test.describe(suite.description, () => {
    suite.scenarios.forEach((name, scenarioIndex) => {
      test(name, async ({ browser, page }) => {
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
