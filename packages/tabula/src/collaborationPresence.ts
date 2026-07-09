import type {
  CollaborationCollaborator,
  CollaborationLiveSelection,
} from "./collaborationTypes";

const clampOffset = (text: string, offset: number) => Math.max(0, Math.min(offset, text.length));

export const getLineNumberForPresenceOffset = (text: string, offset: number) => {
  const targetOffset = clampOffset(text, offset);
  let lineNumber = 1;

  for (let index = 0; index < targetOffset; index += 1) {
    if (text.charCodeAt(index) === 10) {
      lineNumber += 1;
    }
  }

  return lineNumber;
};

export const getLineNumberForPresenceSelection = (text: string, selection?: CollaborationLiveSelection) => {
  if (!selection) {
    return null;
  }

  const metadataLineNumber = selection.lineNumber ?? selection.toLineNumber;
  if (typeof metadataLineNumber === "number" && Number.isInteger(metadataLineNumber) && metadataLineNumber > 0) {
    return metadataLineNumber;
  }

  return getLineNumberForPresenceOffset(text, selection.to);
};

export const isCollaboratorInFile = (
  collaborator: CollaborationCollaborator,
  currentFileTitle?: string,
  currentRoomId?: string,
  currentDocumentId?: string,
) => {
  if (currentDocumentId && collaborator.activeDocumentId) {
    return collaborator.activeDocumentId === currentDocumentId;
  }

  if (currentRoomId && collaborator.roomId) {
    return collaborator.roomId === currentRoomId;
  }

  return !currentFileTitle || !collaborator.fileTitle || collaborator.fileTitle === currentFileTitle;
};

export const getCollaboratorPresenceDetail = (
  collaborator: CollaborationCollaborator,
  text: string,
  currentFileTitle?: string,
  currentRoomId?: string,
  currentDocumentId?: string,
) => {
  if (!isCollaboratorInFile(collaborator, currentFileTitle, currentRoomId, currentDocumentId)) {
    return `${collaborator.kind === "agent" ? "Agent viewing" : "Viewing"} ${collaborator.fileTitle}`;
  }

  const lineNumber = getLineNumberForPresenceSelection(text, collaborator.selection);
  const prefix = collaborator.kind === "agent" ? "Agent" : "";
  const detail = lineNumber ? `Line ${lineNumber}` : "In this file";
  return prefix ? `${prefix} - ${detail}` : detail;
};

export const getCollaboratorPresenceLabel = (collaborator: CollaborationCollaborator, text = "") => {
  const lineNumber = getLineNumberForPresenceSelection(text, collaborator.selection);
  const segments = [collaborator.name];

  if (collaborator.kind === "agent") {
    segments.push("agent");
  }

  if (collaborator.fileTitle) {
    segments.push(collaborator.fileTitle);
  }

  if (lineNumber) {
    segments.push(`line ${lineNumber}`);
  }

  return segments.join(" - ");
};
