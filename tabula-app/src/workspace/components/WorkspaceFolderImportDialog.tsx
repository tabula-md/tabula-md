import { FolderOpen, X } from "lucide-react";
import {
  getKnowledgeProfileDefinition,
  type KnowledgeProfileKind,
} from "@tabula-md/tabula";
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
  const detectionGroups = profile.detections.reduce(
    (groups, detection) => {
      const group = groups.get(detection.kind) ?? [];
      group.push(detection);
      groups.set(detection.kind, group);
      return groups;
    },
    new Map<
      KnowledgeProfileKind,
      WorkspaceImportProfile["detections"][number][]
    >(),
  );

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
          {[...detectionGroups].map(([kind, detections]) => (
            <div key={kind}>
              <dt>{copy.profileKind(kind)}</dt>
              <dd className="workspace-import-profile-detections">
                {detections.map((detection) => {
                  const definition = getKnowledgeProfileDefinition(
                    detection.profileId,
                  );
                  return (
                    <div
                      className="workspace-import-profile-detection"
                      key={detection.profileId}
                    >
                      <strong>
                        {definition?.label ?? detection.profileId}
                      </strong>
                      <small>
                        {[
                          copy.confidence(detection.confidence),
                          typeof detection.fileCount === "number"
                            ? copy.profileFileCount(detection.fileCount)
                            : "",
                        ].filter(Boolean).join(" · ")}
                      </small>
                      {detection.evidence.length > 0 && (
                        <ul>
                          {detection.evidence.map((evidence, index) => (
                            <li
                              key={`${detection.profileId}:${evidence.code}:${index}`}
                            >
                              {copy.evidence(evidence)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {detection.roleAssignments && (
                        <div className="workspace-import-role-groups">
                          {([
                            "source-material",
                            "compiled-knowledge",
                            "workflow-rules",
                          ] as const).map((role) => {
                            const assignments = detection.roleAssignments?.filter(
                              (assignment) => assignment.role === role,
                            ) ?? [];
                            if (assignments.length === 0) return null;
                            return (
                              <div key={role}>
                                <span>{copy.artifactRole(role)}</span>
                                <ul>
                                  {assignments.slice(0, 3).map((assignment) => (
                                    <li key={`${role}:${assignment.path}`}>
                                      <span>{assignment.path}</span>
                                      <small>{copy.roleBasis(assignment.basis)}</small>
                                    </li>
                                  ))}
                                  {assignments.length > 3 && (
                                    <li>{copy.more(assignments.length - 3)}</li>
                                  )}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </dd>
            </div>
          ))}
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
        {profile.diagnostics.length > 0 && (
          <p className="workspace-import-profile-warning">
            {copy.detectorWarning(profile.diagnostics.length)}
          </p>
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
