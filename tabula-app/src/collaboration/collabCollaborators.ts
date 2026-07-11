export {
  createCollaboratorRegistry,
  type CollaboratorRegistry,
} from "@tabula-md/tabula";
import { ROOM_ACTOR_COLORS } from "@tabula-md/tabula";

type NamedCollaborator = {
  color?: string;
  id: string;
  name: string;
};

const getNormalizedCollaboratorName = (name: string) =>
  name.trim().toLowerCase();

export const getCollaboratorDisplayList = <Collaborator extends NamedCollaborator>(
  collaborators: readonly Collaborator[],
): Collaborator[] => {
  const groups = new Map<string, Collaborator[]>();
  for (const collaborator of collaborators) {
    const key = getNormalizedCollaboratorName(collaborator.name);
    const group = groups.get(key) ?? [];
    group.push(collaborator);
    groups.set(key, group);
  }

  const displayNames = new Map<string, string>();
  const displayColors = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const usedColors = new Set<string>();
    [...group]
      .sort((first, second) => first.id.localeCompare(second.id))
      .forEach((collaborator, index) => {
        const baseName = collaborator.name.trim() || "Participant";
        displayNames.set(collaborator.id, index === 0 ? baseName : `${baseName} ${index + 1}`);
        const color = collaborator.color?.toLowerCase();
        if (!color) return;
        const displayColor = usedColors.has(color)
          ? ROOM_ACTOR_COLORS.find((candidate) => !usedColors.has(candidate.toLowerCase()))
          : collaborator.color;
        if (displayColor) {
          displayColors.set(collaborator.id, displayColor);
          usedColors.add(displayColor.toLowerCase());
        }
      });
  }

  return collaborators.map((collaborator) => {
    const displayName = displayNames.get(collaborator.id);
    const displayColor = displayColors.get(collaborator.id);
    return displayName || displayColor
      ? { ...collaborator, name: displayName ?? collaborator.name, color: displayColor ?? collaborator.color }
      : collaborator;
  });
};
