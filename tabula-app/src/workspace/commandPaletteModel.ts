export type CommandPaletteCandidate<TKind extends string = string> = {
  id: string;
  kind: TKind;
  label: string;
  searchText: string;
  priority: number;
};

const normalize = (value: string) => value
  .normalize("NFKD")
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

const getMatchScore = (candidate: CommandPaletteCandidate, query: string) => {
  const label = normalize(candidate.label);
  const searchText = normalize(candidate.searchText);
  const terms = normalize(query).split(" ").filter(Boolean);
  if (terms.length === 0) return candidate.priority;
  if (!terms.every((term) => searchText.includes(term))) return undefined;

  const normalizedQuery = terms.join(" ");
  let score = candidate.priority;
  if (label === normalizedQuery) score += 1_000;
  else if (label.startsWith(normalizedQuery)) score += 600;
  else if (label.includes(normalizedQuery)) score += 300;
  score -= Math.max(0, searchText.indexOf(terms[0] ?? ""));
  return score;
};

export const rankCommandPaletteCandidates = <TCandidate extends CommandPaletteCandidate>(
  candidates: readonly TCandidate[],
  query: string,
) => candidates
  .map((candidate, index) => ({
    candidate,
    index,
    score: getMatchScore(candidate, query),
  }))
  .filter((entry): entry is typeof entry & { score: number } => entry.score !== undefined)
  .sort((first, second) => second.score - first.score || first.index - second.index)
  .map(({ candidate }) => candidate);
