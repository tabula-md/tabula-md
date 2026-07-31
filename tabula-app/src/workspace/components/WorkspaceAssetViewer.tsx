import { useEffect, useMemo } from "react";
import { Download } from "lucide-react";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type { WorkspaceFile } from "../workspaceStorage";
import {
  formatWorkspaceAssetBytes,
  getWorkspaceFilePresentation,
} from "../workspaceFilePresentation";
import { getWorkspaceAssetCopy } from "../workspaceAssetLocale";
import { WorkspaceFileTypeIcon } from "./WorkspaceFileTypeIcon";

type WorkspaceAssetViewerProps = {
  file: WorkspaceFile;
  language: WorkspaceLanguage;
};

export function WorkspaceAssetViewer({
  file,
  language,
}: WorkspaceAssetViewerProps) {
  const presentation = useMemo(
    () => getWorkspaceFilePresentation(file),
    [file.artifact, file.text, file.title],
  );
  const copy = getWorkspaceAssetCopy(language);
  const previewUrl = useMemo(() => {
    if (
      presentation.kind !== "asset" ||
      (presentation.viewer !== "image" && presentation.viewer !== "pdf")
    ) {
      return "";
    }
    return URL.createObjectURL(new Blob(
      [Uint8Array.from(presentation.bytes).buffer],
      { type: presentation.mimeType },
    ));
  }, [presentation]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  if (presentation.kind !== "asset") return null;
  const downloadTooltip = [
    copy.download,
    presentation.format,
    formatWorkspaceAssetBytes(presentation.bytes.byteLength),
  ].join(" · ");

  const download = () => {
    const url = URL.createObjectURL(new Blob(
      [Uint8Array.from(presentation.bytes).buffer],
      { type: presentation.mimeType },
    ));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.title;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <>
      <section
        className="document-toolbar-row workspace-asset-toolbar"
        aria-label={copy.toolbar}
      >
        <nav className="document-controls" aria-label={copy.actions}>
          <button
            className="ui-icon-button tool-button workspace-asset-action"
            type="button"
            aria-label={copy.download}
            data-tooltip={downloadTooltip}
            onClick={download}
          >
            <Download size={16} aria-hidden="true" />
          </button>
        </nav>
      </section>

      <section
        className="workspace workspace-asset-workspace"
        aria-label={copy.region(file.title)}
      >
        <div className={`workspace-asset-content ${presentation.viewer}`}>
          {presentation.viewer === "image" && previewUrl && (
            <img
              className="workspace-asset-image"
              src={previewUrl}
              alt={copy.imagePreview(file.title)}
            />
          )}
          {presentation.viewer === "pdf" && previewUrl && (
            <iframe
              className="workspace-asset-pdf"
              src={previewUrl}
              title={copy.pdfPreview(file.title)}
            />
          )}
          {presentation.viewer === "binary" && (
            <div className="workspace-asset-unavailable">
              <WorkspaceFileTypeIcon kind={presentation.icon} size={24} />
              <strong>{copy.previewUnavailable}</strong>
              <p>{copy.previewUnavailableDescription}</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
