import { useEffect, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
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
  const presentation = getWorkspaceFilePresentation(file);
  const copy = getWorkspaceAssetCopy(language);
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (
      presentation.kind !== "asset" ||
      (presentation.viewer !== "image" && presentation.viewer !== "pdf")
    ) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(new Blob(
      [Uint8Array.from(presentation.bytes).buffer],
      { type: presentation.mimeType },
    ));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [
    file.id,
    file.text,
    file.title,
    presentation.kind,
    presentation.kind === "asset" ? presentation.mimeType : "",
    presentation.kind === "asset" ? presentation.viewer : "",
  ]);

  if (presentation.kind !== "asset") return null;
  const downloadTooltip = [
    copy.download,
    presentation.format,
    formatWorkspaceAssetBytes(presentation.bytes.byteLength),
  ].join(" · ");

  const copyContents = async () => {
    if (presentation.viewer !== "text") return;
    await navigator.clipboard.writeText(presentation.text ?? "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

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
          {presentation.viewer === "text" && (
            <button
              className="ui-icon-button tool-button workspace-asset-action"
              type="button"
              aria-label={copied ? copy.copied : copy.copy}
              data-tooltip={copied ? copy.copied : copy.copy}
              onClick={() => void copyContents()}
            >
              {copied ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}
            </button>
          )}
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
          {presentation.viewer === "text" && (
            <pre className="workspace-asset-source">
              <code>{presentation.text}</code>
            </pre>
          )}
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
