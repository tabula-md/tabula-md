import { FileOutput } from "lucide-react";
import type { JsonShareController } from "./useJsonShareController";
import type { WorkspaceShareCopy } from "../workspace/workspaceLocale";
import { ShareModeHeader } from "./ShareModeHeader";
import { ShareResultDetails } from "./ShareResultDetails";

type ShareExportResultProps = {
  copy: WorkspaceShareCopy;
  exportLinkCopied: boolean;
  jsonShare: JsonShareController;
  onCopyShareableLink: () => void;
};

export function ShareExportResult({
  copy,
  exportLinkCopied,
  jsonShare,
  onCopyShareableLink,
}: ShareExportResultProps) {
  const formattedExpiry = jsonShare.expiresAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(jsonShare.expiresAt),
      )
    : undefined;

  return (
    <section
      className="share-export-result share-result-surface"
      aria-labelledby="share-export-result-title"
    >
      <ShareModeHeader
        description={copy.shareable.description}
        headingId="share-export-result-title"
        headingLevel={2}
        icon={<FileOutput size={18} />}
        title={copy.shareable.title}
      />
      <ShareResultDetails
        copied={exportLinkCopied}
        copy={copy}
        documentCount={jsonShare.documentCount}
        link={jsonShare.url ? {
          canCopy: true,
          display: jsonShare.urlPreview,
          title: jsonShare.url,
        } : undefined}
        metadata={copy.shareable.snapshotMetadata(formattedExpiry)}
        onCopyLink={onCopyShareableLink}
        preparingText={copy.shareable.preparing}
      />
    </section>
  );
}
