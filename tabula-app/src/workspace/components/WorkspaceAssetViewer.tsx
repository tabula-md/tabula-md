import { useEffect, useMemo, useState } from "react";
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
  const presentation = useMemo(
    () => getWorkspaceFilePresentation(file),
    [file.artifact, file.text, file.title],
  );
  const copy = getWorkspaceAssetCopy(language);
  const [copied, setCopied] = useState(false);
  const previewUrl = useMemo(() => {
    if (
      presentation.kind !== "asset" ||
      presentation.viewer === "text" ||
      presentation.viewer === "binary"
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

  const copyText = async () => {
    if (presentation.viewer !== "text") return;
    await navigator.clipboard.writeText(presentation.text ?? "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
      <section
        className="document-toolbar-row workspace-asset-toolbar"
        aria-label={copy.toolbar}
      >
        <span className="workspace-asset-identity" aria-hidden="true">
          <WorkspaceFileTypeIcon kind={presentation.icon} size={16} />
          <span>{presentation.format}</span>
          <span>·</span>
          <span>{formatWorkspaceAssetBytes(presentation.bytes.byteLength)}</span>
        </span>
        <nav className="document-controls" aria-label={copy.actions}>
          {presentation.viewer === "text" && (
            <button
              className="ui-icon-button tool-button workspace-asset-action"
              type="button"
              aria-label={copied ? copy.copied : copy.copy}
              data-tooltip={copied ? copy.copied : copy.copy}
              onClick={() => void copyText()}
            >
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
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
          {presentation.viewer === "audio" && previewUrl && (
            <div className="workspace-media-player audio">
              <WorkspaceFileTypeIcon kind="audio" size={28} />
              <audio controls src={previewUrl} aria-label={copy.audioPreview(file.title)} />
            </div>
          )}
          {presentation.viewer === "video" && previewUrl && (
            <video
              className="workspace-asset-video"
              controls
              src={previewUrl}
              aria-label={copy.videoPreview(file.title)}
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
