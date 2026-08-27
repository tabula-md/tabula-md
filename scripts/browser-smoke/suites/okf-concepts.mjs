import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const id = "okf-concepts";
export const description = "OKF folders use the same lossless import and export boundaries as other workspaces.";

const fixtureRoot = path.resolve(
  "scripts/browser-smoke/fixtures/openwiki-okf",
);

const readFixtureEntries = async (directory, relativeDirectory = "") => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((first, second) =>
    first.name.localeCompare(second.name))) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await readFixtureEntries(absolutePath, relativePath));
    } else {
      files.push({
        path: relativePath,
        content: await readFile(absolutePath, "utf8"),
      });
    }
  }
  return files;
};

const importFixture = async (page, fixtureEntries) => {
  await page.locator('input[aria-label="Import folder copy…"]').evaluate(
    (input, entries) => {
      const dataTransfer = new DataTransfer();
      for (const entry of entries) {
        const name = entry.path.split("/").at(-1);
        const file = new File([entry.content], name, {
          type: entry.path.endsWith(".md")
            ? "text/markdown"
            : "application/json",
        });
        Object.defineProperty(file, "webkitRelativePath", {
          value: `openwiki-okf/${entry.path}`,
        });
        dataTransfer.items.add(file);
      }
      Object.defineProperty(input, "files", {
        configurable: true,
        value: dataTransfer.files,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    fixtureEntries,
  );
};

export async function run(ctx) {
  const {
    browser,
    expect,
    openProjectMenu,
    waitForActiveTab,
    withPage,
  } = ctx;
  const fixtureEntries = await readFixtureEntries(fixtureRoot);

  await withPage(browser, "/", async (page) => {
    await importFixture(page, fixtureEntries);

    const replaceDialog = page.getByRole("dialog", {
      name: "Replace workspace?",
    });
    await replaceDialog.waitFor();
    expect(
      await replaceDialog.getByText(
        "This replaces the current documents and comments.",
        { exact: true },
      ).isVisible(),
      "Folder import should explain only the destructive replacement boundary.",
    );
    expect(
      (await replaceDialog.getByText(/OKF|OpenWiki|Detected workspace/).count()) === 0,
      "Import should not turn knowledge-format detection into a review step.",
    );

    await replaceDialog.getByRole("button", {
      name: "Import folder",
      exact: true,
    }).click();
    await page.locator(".empty-file-state").waitFor({ state: "visible" });

    if ((await page.locator(".left-panel").count()) === 0) {
      await page.locator(".top-left-zone").getByRole("button", {
        name: "Toggle workspace panel",
        exact: true,
      }).click();
    }
    const filesPanel = page.locator(".left-panel");
    await filesPanel.waitFor({ state: "visible" });
    await filesPanel.locator(".left-panel-body.files").waitFor({
      state: "visible",
    });
    expect(
      await filesPanel.getByRole("button", {
        name: "Open .last-update.json",
        exact: true,
      }).isVisible(),
      "Non-Markdown workspace files should survive import without being reviewed or excluded.",
    );
    await filesPanel.getByRole("button", {
      name: "Open runtime.md",
      exact: true,
    }).click();
    await waitForActiveTab(page, { exact: "runtime.md" });

    await openProjectMenu(page);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", {
      name: "Export workspace (.zip)",
      exact: true,
    }).click();
    const download = await downloadPromise;

    expect(
      download.suggestedFilename().endsWith(".zip") &&
        (await page.getByRole("dialog", {
          name: "Review workspace export",
        }).count()) === 0,
      "Export should download the workspace immediately without a knowledge-review gate.",
    );
  });
}
