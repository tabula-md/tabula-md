import { describe, expect, it } from "vitest";
import {
  derivePatchedPreviewBodyTextChange,
  derivePreviewBodyTextChange,
  type PreviewBodyTextChangeSnapshot,
} from "./previewBodyTextChange";

const createSnapshot = (
  text: string,
  previewBodyStartOffset: number,
  fileId = "file-a",
): PreviewBodyTextChangeSnapshot => ({
  fileId,
  previewBody: text.slice(previewBodyStartOffset),
  previewBodyStartOffset,
  previewSourceLineOffset: 0,
  text,
});

describe("preview body text change", () => {
  it("maps document patches into preview body patches when the body offset is stable", () => {
    const previousText = ["---", "title: Demo", "---", "", "# Title", "", "Body"].join("\n");
    const previousBodyStartOffset = previousText.indexOf("# Title");
    const insertAt = previousText.indexOf("Body") + "Body".length;
    const insert = " updated";
    const currentText = `${previousText.slice(0, insertAt)}${insert}${previousText.slice(insertAt)}`;

    expect(
      derivePreviewBodyTextChange({
        currentSnapshot: createSnapshot(currentText, previousBodyStartOffset),
        previousSnapshot: createSnapshot(previousText, previousBodyStartOffset),
        textChange: {
          docLength: currentText.length,
          lineCount: currentText.split("\n").length,
          patches: [{ from: insertAt, to: insertAt, insert }],
        },
      }),
    ).toEqual({
      docLength: currentText.slice(previousBodyStartOffset).length,
      lineCount: currentText.split("\n").length,
      patches: [{ from: insertAt - previousBodyStartOffset, to: insertAt - previousBodyStartOffset, insert }],
    });
  });

  it("ignores metadata-only edits before the preview body", () => {
    const previousText = ["---", "title: Demo", "---", "", "# Title"].join("\n");
    const currentText = previousText.replace("Demo", "Changed");
    const previousBodyStartOffset = previousText.indexOf("# Title");

    expect(
      derivePreviewBodyTextChange({
        currentSnapshot: createSnapshot(currentText, previousBodyStartOffset),
        previousSnapshot: createSnapshot(previousText, previousBodyStartOffset),
        textChange: {
          docLength: currentText.length,
          lineCount: currentText.split("\n").length,
          patches: [{ from: previousText.indexOf("Demo"), to: previousText.indexOf("Demo") + "Demo".length, insert: "Changed" }],
        },
      }),
    ).toBeNull();
  });

  it("ignores patches when frontmatter changes move the preview body start", () => {
    const previousText = ["---", "title: Demo", "---", "", "# Title"].join("\n");
    const insert = "description: Added\n";
    const insertAt = previousText.indexOf("---", 3);
    const currentText = `${previousText.slice(0, insertAt)}${insert}${previousText.slice(insertAt)}`;

    expect(
      derivePreviewBodyTextChange({
        currentSnapshot: createSnapshot(currentText, currentText.indexOf("# Title")),
        previousSnapshot: createSnapshot(previousText, previousText.indexOf("# Title")),
        textChange: {
          docLength: currentText.length,
          lineCount: currentText.split("\n").length,
          patches: [{ from: insertAt, to: insertAt, insert }],
        },
      }),
    ).toBeNull();
  });

  it("rejects stale document patches", () => {
    const previousText = "# Title\n\nBody";
    const currentText = "# Title\n\nChanged";

    expect(
      derivePreviewBodyTextChange({
        currentSnapshot: createSnapshot(currentText, 0),
        previousSnapshot: createSnapshot(previousText, 0),
        textChange: {
          docLength: currentText.length,
          lineCount: currentText.split("\n").length,
          patches: [{ from: 0, to: 0, insert: "stale" }],
        },
      }),
    ).toBeNull();
  });

  it("patches preview body directly without requiring full preview body derivation", () => {
    const previousText = ["---", "title: Demo", "---", "", "# Title", "", "Body"].join("\n");
    const previousBodyStartOffset = previousText.indexOf("# Title");
    const insertAt = previousText.indexOf("Body") + "Body".length;
    const insert = " updated";
    const currentText = `${previousText.slice(0, insertAt)}${insert}${previousText.slice(insertAt)}`;

    expect(
      derivePatchedPreviewBodyTextChange({
        currentFileId: "file-a",
        currentText,
        previousSnapshot: createSnapshot(previousText, previousBodyStartOffset),
        textChange: {
          docLength: currentText.length,
          lineCount: currentText.split("\n").length,
          patches: [{ from: insertAt, to: insertAt, insert }],
        },
      }),
    ).toEqual({
      previewBody: "# Title\n\nBody updated",
      previewBodyStartOffset: previousBodyStartOffset,
      previewSourceLineOffset: 0,
      textChange: {
        docLength: "# Title\n\nBody updated".length,
        lineCount: currentText.split("\n").length,
        patches: [{ from: insertAt - previousBodyStartOffset, to: insertAt - previousBodyStartOffset, insert }],
      },
    });
  });

  it("does not patch preview body directly when edits happen before the body", () => {
    const previousText = ["---", "title: Demo", "---", "", "# Title"].join("\n");
    const currentText = previousText.replace("Demo", "Changed");
    const previousBodyStartOffset = previousText.indexOf("# Title");

    expect(
      derivePatchedPreviewBodyTextChange({
        currentFileId: "file-a",
        currentText,
        previousSnapshot: createSnapshot(previousText, previousBodyStartOffset),
        textChange: {
          docLength: currentText.length,
          lineCount: currentText.split("\n").length,
          patches: [{ from: previousText.indexOf("Demo"), to: previousText.indexOf("Demo") + "Demo".length, insert: "Changed" }],
        },
      }),
    ).toBeNull();
  });

  it("rejects stale direct preview body patches even when the document length matches", () => {
    const previousText = "# Title\n\nAlpha";
    const currentText = "# Title\n\nGamma";
    const replaceStart = previousText.indexOf("Alpha");

    expect(
      derivePatchedPreviewBodyTextChange({
        currentFileId: "file-a",
        currentText,
        previousSnapshot: createSnapshot(previousText, 0),
        textChange: {
          docLength: currentText.length,
          lineCount: currentText.split("\n").length,
          patches: [{ from: replaceStart, to: replaceStart + "Alpha".length, insert: "Omega" }],
        },
      }),
    ).toBeNull();
  });
});
