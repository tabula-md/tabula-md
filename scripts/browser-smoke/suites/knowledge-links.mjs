export const id = "knowledge-links";
export const description = "Knowledge link rows, navigation, and ambiguous Wikilink resolution.";

export async function run(ctx) {
  const {
    browser,
    ensureSidePanelOpen,
    expect,
    waitForActiveTab,
    waitForEditorReady,
    waitForPanelTab,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    await page.locator('input[aria-label="Open folder"]').evaluate((input) => {
      const dataTransfer = new DataTransfer();
      const addMarkdown = (path, markdown) => {
        const name = path.split("/").at(-1);
        const file = new File([markdown], name, { type: "text/markdown" });
        Object.defineProperty(file, "webkitRelativePath", {
          value: `Knowledge links/${path}`,
        });
        dataTransfer.items.add(file);
      };
      addMarkdown("Start.md", [
        "# Start",
        "",
        "[Guide](Guide.md)",
        "",
        "[Guide again](Guide.md)",
        "",
        "[Missing guide](Missing.md)",
        "",
        "Choose [[Shared]].",
        "",
        "[Tabula website](https://tabula.md)",
      ].join("\n"));
      addMarkdown("Guide.md", "# Guide\n\n[Start](Start.md)");
      addMarkdown("team-a/Shared.md", "# Team A shared page");
      addMarkdown("team-b/Shared.md", "# Team B shared page");
      Object.defineProperty(input, "files", {
        configurable: true,
        value: dataTransfer.files,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.getByRole("dialog", { name: "Open folder" }).waitFor();
    await page.getByRole("button", { name: "Open folder", exact: true }).click();
    await page.locator(".empty-file-state").waitFor({ state: "visible" });

    await ensureSidePanelOpen(page);
    await page.getByRole("button", { name: "Files", exact: true }).click();
    await waitForPanelTab(page, "Files");
    await page.getByRole("button", { name: "Open Start.md", exact: true }).click();
    await waitForActiveTab(page, { exact: "Start.md" });
    await waitForEditorReady(page, { mode: "edit" });
    await page.getByRole("button", { name: "Links", exact: true }).click();
    await waitForPanelTab(page, "Links");

    const outgoing = page.locator('.right-links-section[aria-label="Outgoing"]');
    const topLevelRows = outgoing.locator([
      ":scope > .right-links-list > div > .right-links-row",
      ":scope > .right-links-list > div > .right-links-target-with-resolver > .right-links-row",
    ].join(", "));
    expect(
      (await outgoing.locator(".right-links-count").textContent()) === "4" &&
        (await topLevelRows.count()) === 4,
      "Outgoing should count unique visible targets rather than raw link mentions.",
    );
    expect(
      (await topLevelRows.locator(".right-links-row-title").count()) === 4 &&
        (await topLevelRows.locator(".right-links-row-target").count()) === 4,
      "Resolved, broken, ambiguous, and external targets should use the same two-line row structure.",
    );
    expect(
      (await topLevelRows.locator("svg").count()) === 0 &&
        (await page.locator(".right-links-section-direction svg").count()) === 2 &&
        (await page.locator(".right-links-section-chevron").count()) === 2,
      "Relationship headings should keep direction icons while target rows stay icon-free.",
    );
    expect(
      (await outgoing.getByText("Not found", { exact: true }).count()) === 1 &&
        (await outgoing.getByText("2 matches", { exact: true }).count()) === 1 &&
        (await outgoing.getByText(/Choose\s*[·•]\s*2/).count()) === 0,
      "Exceptional rows should use plain parallel states without punctuation-based action badges.",
    );
    const outgoingToggle = page.getByRole("button", {
      name: "Collapse Outgoing",
      exact: true,
    });
    await outgoingToggle.click();
    expect(
      (await outgoing.locator(":scope > .right-links-list").count()) === 0 &&
        (await outgoing.locator(".right-links-count").textContent()) === "4",
      "Collapsing a relationship should hide its rows while preserving the target count.",
    );
    await page.getByRole("button", { name: "Outline", exact: true }).click();
    await waitForPanelTab(page, "Outline");
    await page.getByRole("button", { name: "Links", exact: true }).click();
    await waitForPanelTab(page, "Links");
    expect(
      (await page.getByRole("button", {
        name: "Expand Outgoing",
        exact: true,
      }).count()) === 1 &&
        (await outgoing.locator(":scope > .right-links-list").count()) === 0,
      "Relationship collapse state should survive switching between right-panel tabs.",
    );
    await page.getByRole("button", {
      name: "Expand Outgoing",
      exact: true,
    }).click();
    const sectionLabelBox = await outgoing.locator(
      ".right-links-section-toggle > span",
    ).nth(1).boundingBox();
    const firstRowTitleBox = await topLevelRows.first()
      .locator(".right-links-row-title").boundingBox();
    expect(
      sectionLabelBox && firstRowTitleBox &&
        Math.abs(sectionLabelBox.x - firstRowTitleBox.x) <= 1,
      "Top-level link titles should align with the relationship label, not its icon.",
    );
    expect(
      (await page.locator('.right-links-section[aria-label="Issues"]').count()) === 0,
      "Link status should not create a third relationship section.",
    );
    expect(
      !(await topLevelRows.locator(".right-links-row-target").allTextContents())
        .some((text) => text.includes(" · ")),
      "Link rows should not concatenate relationship statistics into their path line.",
    );

    const website = outgoing.getByRole("link", {
      name: "Open external link Tabula website",
      exact: true,
    });
    expect(
      (await website.getAttribute("href")) === "https://tabula.md" &&
        (await website.getAttribute("target")) === "_blank",
      "Safe web links should open directly in a new browser tab.",
    );

    await outgoing.getByRole("button", {
      name: "2 matching documents — choose target for Shared",
      exact: true,
    }).click();
    const teamACandidate = outgoing.getByRole("button", {
      name: "Resolve link with team-a/Shared.md",
      exact: true,
    });
    const teamBCandidate = outgoing.getByRole("button", {
      name: "Resolve link with team-b/Shared.md",
      exact: true,
    });
    expect(
      (await teamACandidate.count()) === 1 && (await teamBCandidate.count()) === 1,
      "Ambiguous targets should reveal document-shaped candidate rows only on demand.",
    );
    const ambiguousTitleBox = await outgoing.getByText("Shared", { exact: true })
      .first().boundingBox();
    const candidateTitleBox = await teamACandidate.locator(
      ".right-links-row-title",
    ).boundingBox();
    expect(
      ambiguousTitleBox && candidateTitleBox &&
        candidateTitleBox.x > ambiguousTitleBox.x + 8,
      "Ambiguous candidates should add one visible indentation level beneath their target.",
    );
    await teamACandidate.click();
    await waitForEditorReady(page, { mode: "edit" });
    expect(
      (await page.locator(".cm-content").textContent())?.includes("[[/team-a/Shared]]"),
      "Choosing a candidate should replace the ambiguous Wikilink with an explicit workspace path.",
    );
    await outgoing.getByRole("button", {
      name: "Open team-a/Shared.md",
      exact: true,
    }).waitFor({ state: "visible" });

    const missingGuide = outgoing.getByRole("button", {
      name: "Document not found — go to source: Missing guide",
      exact: true,
    });
    expect(
      (await missingGuide.count()) === 1,
      "A broken target should stay in Outgoing and offer source navigation.",
    );
    await missingGuide.click();
    await waitForEditorReady(page, { mode: "edit" });

    await outgoing.getByRole("button", { name: "Open Guide.md", exact: true }).click();
    await waitForActiveTab(page, { exact: "Guide.md" });
    expect(
      (await page.locator('.right-links-section[aria-label="Backlinks"]')
        .getByRole("button", { name: "Open Start.md", exact: true }).count()) === 1,
      "Opening a resolved target should expose its source as a backlink.",
    );
  });
}
