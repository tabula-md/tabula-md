import { FolderOpen, X } from "lucide-react";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceArchiveEntries } from "../io/workspaceArchive";
import { getWorkspaceFolderImportCopy } from "../io/workspaceFolderImportLocale";
import type { WorkspaceState } from "../workspaceStorage";
import { ModalSurface } from "../../ui/ModalSurface";
import type { WorkspaceImportProfile } from "../io/workspaceImportProfile";

type WorkspaceFolderImportDialogProps = {
  language: WorkspaceLanguage;
  profile: WorkspaceImportProfile;
  workspace: WorkspaceState;
  onCancel: () => void;
  onReplace: () => void;
};

export function WorkspaceFolderImportDialog({
  language,
  profile,
  workspace,
  onCancel,
  onReplace,
}: WorkspaceFolderImportDialogProps) {
  const copy = getWorkspaceFolderImportCopy(language);
  const paths = getWorkspaceArchiveEntries(workspace.files, workspace.folders)
    .filter((entry) => !entry.path.endsWith("/"))
    .map((entry) => entry.path);

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
            <dt>{copy.files}</dt>
            <dd>
              {copy.fileHandling(
                profile.preservedSupportFileCount,
                profile.ignoredFileCount,
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
        <FolderOpen size={18} aria-hidden="true" />
        <div>
          <p>{copy.contains(workspace.files.length, Math.max(0, workspace.folders.length - 1))}</p>
          <ul className="json-import-files" aria-label={copy.paths}>
            {paths.slice(0, 5).map((path) => <li key={path}>{path}</li>)}
            {paths.length > 5 && <li>{copy.more(paths.length - 5)}</li>}
          </ul>
        </div>
      </div>
      <div className="share-modal-actions">
        <button className="ui-modal-action secondary share-modal-secondary" type="button" onClick={onCancel}>{copy.cancel}</button>
        <button className="ui-modal-action share-modal-primary" type="button" data-modal-initial-focus onClick={onReplace}>{copy.open}</button>
      </div>
    </ModalSurface>
  );
}
