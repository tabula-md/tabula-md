import { AlertTriangle, FolderInput, X } from "lucide-react";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceArchiveEntries } from "../io/workspaceArchive";
import { getWorkspaceFolderImportCopy } from "../io/workspaceFolderImportLocale";
import type { WorkspaceState } from "../workspaceStorage";
import { ModalSurface } from "../../ui/ModalSurface";
import type { WorkspaceImportProfile } from "../io/workspaceImportProfile";
import { isMarkdownWorkspacePath } from "../io/workspaceSupportFile";

type WorkspaceFolderImportDialogProps = {
  hasCurrentWorkspace: boolean;
  language: WorkspaceLanguage;
  profile: WorkspaceImportProfile;
  workspace: WorkspaceState;
  onCancel: () => void;
  onExportCurrentWorkspace: () => void;
  onReplace: () => void;
};

export function WorkspaceFolderImportDialog({
  hasCurrentWorkspace,
  language,
  profile,
  workspace,
  onCancel,
  onExportCurrentWorkspace,
  onReplace,
}: WorkspaceFolderImportDialogProps) {
  const copy = getWorkspaceFolderImportCopy(language);
  const importedPaths = getWorkspaceArchiveEntries(workspace.files, workspace.folders)
    .filter((entry) => !entry.path.endsWith("/"))
    .map((entry) => entry.path);
  const markdownPaths = importedPaths.filter(isMarkdownWorkspacePath);

  const pathSection = (label: string, paths: readonly string[]) => {
    if (paths.length === 0) return null;
    return (
      <section className="workspace-folder-import-paths">
        <h3>{label}</h3>
        <ul className="json-import-files" aria-label={label}>
          {paths.map((path) => <li key={path}>{path}</li>)}
        </ul>
      </section>
    );
  };

  return (
    <ModalSurface
      ariaLabelledBy="workspace-folder-title"
      className="json-import-modal workspace-folder-import-modal"
      onClose={onCancel}
    >
      <button className="share-modal-close" type="button" aria-label={copy.close} onClick={onCancel}>
        <X size={18} />
      </button>
      <header className="share-modal-header compact">
        <h2 id="workspace-folder-title">{copy.title}</h2>
        <p>{copy.description}</p>
      </header>
      <section
        className="workspace-import-profile"
        aria-label={copy.profileLabel}
      >
        <div className="workspace-import-profile-heading">
          <span>{copy.detected}</span>
          <strong>{copy.format(profile)}</strong>
        </div>
        <dl className="workspace-import-profile-fields">
          {profile.conventions.length > 0 && (
            <div>
              <dt>{copy.conventions}</dt>
              <dd>{profile.conventions.map(copy.convention).join(", ")}</dd>
            </div>
          )}
          {profile.linkSyntaxes.length > 0 && (
            <div>
              <dt>{copy.links}</dt>
              <dd>{profile.linkSyntaxes.map(copy.linkSyntax).join(", ")}</dd>
            </div>
          )}
          <div>
            <dt>{copy.contents}</dt>
            <dd>
              {copy.summary(
                profile.markdownFileCount,
                profile.preservedSupportFileCount,
              )}
            </dd>
          </div>
        </dl>
        {profile.evidence.length > 0 && (
          <ul className="workspace-import-profile-evidence">
            {profile.evidence.slice(0, 4).map((evidence) => (
              <li key={`${evidence.code}:${evidence.value ?? evidence.count ?? ""}`}>
                {copy.evidence(evidence)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="json-import-copy">
        <FolderInput size={18} aria-hidden="true" />
        <div>
          {pathSection(copy.markdownPaths, markdownPaths)}
          {pathSection(copy.supportPaths, profile.preservedSupportPaths)}
          <p className="workspace-folder-import-support-note">
            {copy.supportNote}
          </p>
        </div>
      </div>
      {hasCurrentWorkspace && (
        <div className="json-import-warning" role="note">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>{copy.replacementWarning}</p>
        </div>
      )}
      <div className="share-modal-actions">
        {hasCurrentWorkspace && (
          <button
            className="ui-modal-action secondary share-modal-secondary"
            type="button"
            onClick={onExportCurrentWorkspace}
          >
            {copy.exportCurrentWorkspace}
          </button>
        )}
        <button className="ui-modal-action secondary share-modal-secondary" type="button" onClick={onCancel}>{copy.cancel}</button>
        <button className="ui-modal-action share-modal-primary" type="button" data-modal-initial-focus onClick={onReplace}>{copy.importAndReplace}</button>
      </div>
    </ModalSurface>
  );
}
