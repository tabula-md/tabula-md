export const id = "live-folder";
export const description = "Local folder connection progress, review, and failure recovery.";
export const scenarios = [
  "connects a generated-folder workspace on a narrow screen",
  "connects an empty folder on a wide screen",
  "keeps the current workspace when folder permission is denied",
];

const installLiveFolderPicker = () => {
  const encoder = new TextEncoder();
  const file = (name, content, delay = 0) => ({
    kind: "file",
    name,
    async getFile() {
      if (delay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }
      const bytes = encoder.encode(content);
      return {
        size: bytes.byteLength,
        arrayBuffer: async () => bytes.buffer,
      };
    },
  });
  const directory = (name, children) => ({
    kind: "directory",
    name,
    async *entries() {
      for (const child of children) yield [child.name, child];
    },
    async queryPermission() {
      return "granted";
    },
    async requestPermission() {
      return "granted";
    },
  });
  const root = directory("Knowledge workspace", [
    directory(".git", [file("pack", "generated")]),
    directory("dist", [file("index.js", "generated")]),
    file("README.md", "# Connected folder", 240),
    directory("node_modules", [file("index.js", "generated")]),
  ]);
  Object.defineProperty(window, "showDirectoryPicker", {
    configurable: true,
    value: async () => root,
  });
};

const installEmptyLiveFolderPicker = () => {
  const root = {
    kind: "directory",
    name: "Empty workspace",
    async *entries() {},
    async queryPermission() {
      return "granted";
    },
    async requestPermission() {
      return "granted";
    },
  };
  Object.defineProperty(window, "showDirectoryPicker", {
    configurable: true,
    value: async () => root,
  });
};

const installDeniedLiveFolderPicker = () => {
  Object.defineProperty(window, "showDirectoryPicker", {
    configurable: true,
    value: async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    },
  });
};

const openWorkspaceMenu = async (page) => {
  await page.getByRole("button", {
    name: "Open Workspace menu",
    exact: true,
  }).click();
  await page.getByRole("dialog", {
    name: "Workspace menu",
    exact: true,
  }).waitFor({ state: "visible" });
};

const openLiveFolderConnection = async (page) => {
  await openWorkspaceMenu(page);
  const connectButton = page.getByRole("button", {
    name: "Connect local folder…",
    exact: true,
  });
  await connectButton.waitFor({ state: "visible" });
  await connectButton.click();
};

export async function run(ctx) {
  const {
    browser,
    expect,
    getTabs,
    waitForActiveTab,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    await page.locator(".empty-file-actions")
      .getByRole("button", { name: "New document" })
      .click();
    await waitForActiveTab(page, { exact: "Untitled.md" });
    await openLiveFolderConnection(page);

    const openingDialog = page.getByRole("dialog", {
      name: "Connecting local folder",
    });
    await openingDialog.waitFor({ state: "visible" });
    expect(
      (await getTabs(page)).some((tab) => tab.title === "Untitled.md"),
      "The current workspace should remain intact while the folder is read.",
    );

    const reviewDialog = page.getByRole("dialog", { name: "Open folder" });
    await reviewDialog.waitFor({ state: "visible" });
    expect(
      (await reviewDialog.getByText(".git/", { exact: true }).count()) === 1 &&
        (await reviewDialog.getByText("dist/", { exact: true }).count()) === 1 &&
        (await reviewDialog.getByText("node_modules/", {
          exact: true,
        }).count()) === 1,
      "Generated folders should be excluded explicitly.",
    );
    expect(
      (await getTabs(page)).some((tab) => tab.title === "Untitled.md"),
      "Review should not replace the current workspace.",
    );

    await reviewDialog.getByRole("button", {
      name: "Connect folder",
      exact: true,
    }).click();
    await reviewDialog.waitFor({ state: "hidden" });
    expect(
      !(await getTabs(page)).some((tab) => tab.title === "Untitled.md"),
      "Confirming should replace the previous browser workspace.",
    );

    await openWorkspaceMenu(page);
    await page.getByRole("button", {
      name: "Disconnect local folder…",
      exact: true,
    }).click();
    const disconnectDialog = page.getByRole("dialog", {
      name: "Disconnect local folder?",
    });
    await disconnectDialog.waitFor({ state: "visible" });
    await disconnectDialog.getByRole("button", {
      name: "Disconnect folder",
      exact: true,
    }).click();
    await page.getByText(
      "Local folder disconnected. This workspace is now saved in the browser.",
      { exact: true },
    ).waitFor({ state: "visible" });

    await openWorkspaceMenu(page);
    await page.getByRole("button", {
      name: "Connect local folder…",
      exact: true,
    }).waitFor({ state: "visible" });
    await page.keyboard.press("Escape");

    await page.getByRole("button", {
      name: "Toggle side panel",
      exact: true,
    }).click();
    await page.waitForFunction(() =>
      document.querySelector(
        '.right-file-tree-row.file[data-file-name="README.md"]',
      ) !== null
    );
  }, {
    initScript: installLiveFolderPicker,
    viewport: { width: 420, height: 720 },
  });

  await withPage(browser, "/", async (page) => {
    await page.locator(".empty-file-actions")
      .getByRole("button", { name: "New document" })
      .click();
    await waitForActiveTab(page, { exact: "Untitled.md" });
    await openLiveFolderConnection(page);

    const reviewDialog = page.getByRole("dialog", { name: "Open folder" });
    await reviewDialog.waitFor({ state: "visible" });
    await reviewDialog.getByText("0 files · 0 folders", {
      exact: true,
    }).waitFor();
    await reviewDialog.getByRole("button", {
      name: "Connect folder",
      exact: true,
    }).click();
    await reviewDialog.waitFor({ state: "hidden" });
    expect(
      !(await getTabs(page)).some((tab) => tab.title === "Untitled.md"),
      "Connecting an empty folder should replace the previous browser workspace.",
    );
    expect(
      (await page.getByText(
        "Couldn’t open this workspace.",
        { exact: true },
      ).count()) === 0,
      "An empty folder should connect without an error.",
    );
  }, {
    initScript: installEmptyLiveFolderPicker,
    viewport: { width: 1280, height: 800 },
  });

  await withPage(browser, "/", async (page) => {
    await page.locator(".empty-file-actions")
      .getByRole("button", { name: "New document" })
      .click();
    await waitForActiveTab(page, { exact: "Untitled.md" });
    await openLiveFolderConnection(page);
    await page.getByText(
      "Tabula needs read and write access to connect this folder.",
      { exact: true },
    ).waitFor({ state: "visible" });
    expect(
      (await getTabs(page)).some((tab) => tab.title === "Untitled.md"),
      "A denied connection should keep the current workspace.",
    );
  }, {
    initScript: installDeniedLiveFolderPicker,
    viewport: { width: 1280, height: 800 },
  });
}
