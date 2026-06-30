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

  return getLineNumberForPresenceOffset(text, selection.to);
};

export const isCollaboratorInFile = (
  collaborator: CollaborationCollaborator,
  currentFileTitle?: string,
  currentRoomId?: string,
) => {
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
) => {
  if (!isCollaboratorInFile(collaborator, currentFileTitle, currentRoomId)) {
    return `Viewing ${collaborator.fileTitle}`;
  }

  const lineNumber = getLineNumberForPresenceSelection(text, collaborator.selection);
  return lineNumber ? `Line ${lineNumber}` : "In this file";
};

export const getCollaboratorPresenceLabel = (collaborator: CollaborationCollaborator, text: string) => {
  const lineNumber = getLineNumberForPresenceSelection(text, collaborator.selection);
  const segments = [collaborator.name];

  if (collaborator.fileTitle) {
    segments.push(collaborator.fileTitle);
  }

  if (lineNumber) {
    segments.push(`line ${lineNumber}`);
  }

  return segments.join(" - ");
};
