import { describe, expect, it } from "vitest";
import { rankCommandPaletteCandidates } from "./commandPaletteModel";

const candidates = [
  { id: "new", kind: "command", label: "New document", searchText: "New document create file", priority: 20 },
  { id: "notes", kind: "document", label: "Meeting notes", searchText: "Meeting notes team/meeting-notes", priority: 100 },
  { id: "search", kind: "command", label: "Search workspace", searchText: "Search workspace find content", priority: 10 },
] as const;

describe("rankCommandPaletteCandidates", () => {
  it("keeps initial suggestions in priority order", () => {
    expect(rankCommandPaletteCandidates(candidates, "").map(({ id }) => id)).toEqual([
      "notes",
      "new",
      "search",
    ]);
  });

  it("matches all query terms across labels and keywords", () => {
    expect(rankCommandPaletteCandidates(candidates, "new file").map(({ id }) => id)).toEqual([
      "new",
    ]);
  });

  it("prefers a label prefix over a keyword match", () => {
    expect(rankCommandPaletteCandidates(candidates, "search").map(({ id }) => id)).toEqual([
      "search",
    ]);
  });
});
