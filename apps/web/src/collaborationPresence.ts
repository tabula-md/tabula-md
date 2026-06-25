import type { Collaborator, LiveSelection } from "./collab";

const clampOffset = (text: string, offset: number) => Math.max(0, Math.min(offset, text.length));

export const getLineNumberForOffset = (text: string, offset: number) => {
  const targetOffset = clampOffset(text, offset);
  let lineNumber = 1;

  for (let index = 0; index < targetOffset; index += 1) {
    if (text.charCodeAt(index) === 10) {
      lineNumber += 1;
    }
  }

  return lineNumber;
};

export const getLineNumberForSelection = (text: string, selection?: LiveSelection) => {
  if (!selection) {
    return null;
  }

  return getLineNumberForOffset(text, selection.to);
};

export const getCollaboratorPresenceLabel = (collaborator: Collaborator, text: string) => {
  const lineNumber = getLineNumberForSelection(text, collaborator.selection);
  const segments = [collaborator.name];

  if (collaborator.fileTitle) {
    segments.push(collaborator.fileTitle);
  }

  if (lineNumber) {
    segments.push(`line ${lineNumber}`);
  }

  return segments.join(" - ");
};
