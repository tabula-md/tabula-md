import { describe, expect, it } from "vitest";
import {
  planWorkspaceKnowledgeMaintenance,
} from "./workspaceKnowledgeMaintenance";
import {
  applyWorkspaceRoomKnowledgeMaintenancePlan,
  getWorkspaceRoomKnowledgeDocuments,
  getWorkspaceRoomKnowledgeSnapshot,
  planWorkspaceRoomKnowledgeMaintenance,
} from "./workspaceRoomKnowledgeMaintenance";
import type { WorkspaceSourceDocument } from "./workspaceKnowledgeIndex";
import {
  createWorkspaceRoomCrdt,
  getWorkspaceRoomSnapshot,
  initializeWorkspaceRoomCrdt,
  renameWorkspaceRoomNode,
} from "./workspaceRoomCrdt";
import { WORKSPACE_ROOM_ROOT_ID } from "./workspaceRoomModel";

const document = (
  id: string,
  path: string,
  markdown: string,
): WorkspaceSourceDocument => ({ id, path, markdown });

const updatedMarkdown = (
  previous: readonly WorkspaceSourceDocument[],
  next: readonly WorkspaceSourceDocument[],
  documentId: string,
) => planWorkspaceKnowledgeMaintenance(previous, next)
  .updates.find((update) => update.documentId === documentId)?.markdown;

describe("workspace knowledge maintenance", () => {
  it("rewrites Markdown links, wiki links, and embeds after a target is renamed and moved", () => {
    const source = [
      "[Guide](../guide/Guide.md?view=all#intro)",
      "[Root](/guide/Guide.md#intro)",
      "[Readable](<../guide/Guide.md#intro>)",
      "[Reference][guide]",
      "",
      "[guide]: ../guide/Guide.md#intro \"Guide\"",
      "[[../guide/Guide#Intro|Guide alias]]",
      "![[../guide/Guide#Intro]]",
    ].join("\n");
    const previous = [
      document("start", "docs/Start.md", source),
      document("guide", "guide/Guide.md", "# Guide\n\n## Intro"),
    ];
    const next = [
      document("start", "docs/Start.md", source),
      document("guide", "handbook/Core Guide.md", "# Guide\n\n## Intro"),
    ];

    const plan = planWorkspaceKnowledgeMaintenance(previous, next);

    expect(plan).toMatchObject({
      updatedDocumentCount: 1,
      updatedLinkCount: 6,
      skippedLinkCount: 0,
    });
    expect(updatedMarkdown(previous, next, "start")).toBe([
      "[Guide](../handbook/Core%20Guide.md?view=all#intro)",
      "[Root](/handbook/Core%20Guide.md#intro)",
      "[Readable](<../handbook/Core%20Guide.md#intro>)",
      "[Reference][guide]",
      "",
      "[guide]: ../handbook/Core%20Guide.md#intro \"Guide\"",
      "[[../handbook/Core Guide#Intro|Guide alias]]",
      "![[../handbook/Core Guide#Intro]]",
    ].join("\n"));
  });

  it("rewrites relative links when the source document moves", () => {
    const source = [
      "[Local](Local.md)",
      "[Explicit](./Local.md#part)",
      "[[Local]]",
      "![[Local#Part]]",
    ].join("\n");
    const previous = [
      document("start", "docs/Start.md", source),
      document("local", "docs/Local.md", "# Local\n\n## Part"),
    ];
    const next = [
      document("start", "archive/Start.md", source),
      document("local", "docs/Local.md", "# Local\n\n## Part"),
    ];

    expect(updatedMarkdown(previous, next, "start")).toBe([
      "[Local](../docs/Local.md)",
      "[Explicit](../docs/Local.md#part)",
      "[[Local]]",
      "![[Local#Part]]",
    ].join("\n"));
  });

  it("does not churn a bare wiki link that still resolves to the same document", () => {
    const source = "[[Guide]]";
    const previous = [
      document("start", "notes/Start.md", source),
      document("guide", "docs/Guide.md", "# Guide"),
    ];
    const next = [
      document("start", "notes/Start.md", source),
      document("guide", "handbook/Guide.md", "# Guide"),
    ];

    expect(planWorkspaceKnowledgeMaintenance(previous, next)).toEqual({
      updates: [],
      updatedDocumentCount: 0,
      updatedLinkCount: 0,
      skippedLinkCount: 0,
    });
  });

  it("leaves broken, ambiguous, and external links unchanged", () => {
    const source = [
      "[Missing](Missing.md)",
      "[Website](https://tabula.md)",
      "[[Shared]]",
    ].join("\n");
    const previous = [
      document("start", "Start.md", source),
      document("shared-a", "a/Shared.md", "# A"),
      document("shared-b", "b/Shared.md", "# B"),
    ];
    const next = [
      document("start", "moved/Start.md", source),
      document("shared-a", "a/Shared.md", "# A"),
      document("shared-b", "b/Shared.md", "# B"),
    ];

    expect(planWorkspaceKnowledgeMaintenance(previous, next).updates).toEqual([]);
  });

  it("plans and applies the same maintenance to a live room tree", () => {
    const room = createWorkspaceRoomCrdt({ roomId: "room" });
    initializeWorkspaceRoomCrdt(room, {
      nodes: [
        {
          id: "docs",
          type: "folder",
          title: "docs",
          parentId: WORKSPACE_ROOM_ROOT_ID,
        },
        {
          id: "start",
          type: "document",
          title: "Start.md",
          parentId: WORKSPACE_ROOM_ROOT_ID,
          markdown: "[Guide](docs/Guide.md)",
        },
        {
          id: "guide",
          type: "document",
          title: "Guide.md",
          parentId: "docs",
          markdown: "# Guide",
        },
      ],
    });
    const previous = getWorkspaceRoomKnowledgeSnapshot(room);
    expect(getWorkspaceRoomKnowledgeDocuments(previous).map((item) => item.path))
      .toEqual(["docs/Guide.md", "Start.md"]);

    renameWorkspaceRoomNode(room, "docs", "handbook");
    const plan = planWorkspaceRoomKnowledgeMaintenance(
      previous,
      getWorkspaceRoomKnowledgeSnapshot(room),
    );
    expect(plan).toMatchObject({
      updatedDocumentCount: 1,
      updatedLinkCount: 1,
    });
    expect(applyWorkspaceRoomKnowledgeMaintenancePlan(room, plan)).toBe(true);
    expect(getWorkspaceRoomSnapshot(room).documents.start)
      .toBe("[Guide](handbook/Guide.md)");
  });
});
