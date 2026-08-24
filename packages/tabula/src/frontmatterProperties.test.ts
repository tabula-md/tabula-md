import { describe, expect, it } from "vitest";
import { getFrontmatterProperties } from "./frontmatterProperties";

describe("frontmatter properties model", () => {
  it("keeps arbitrary YAML keys in source order without imposing an OKF schema", () => {
    const model = getFrontmatterProperties(`---
title: Architecture
priority: 3
published: true
tags: [specification, architecture]
owner:
  team: Platform
sources:
  - id: handbook
    resource: https://example.com/handbook
---
Body`);

    expect(model.status).toBe("valid");
    expect(model.properties.map(({ key, kind, editable, itemCount }) => ({
      key,
      kind,
      editable,
      itemCount,
    }))).toEqual([
      { key: "title", kind: "text", editable: true, itemCount: undefined },
      { key: "priority", kind: "number", editable: true, itemCount: undefined },
      { key: "published", kind: "boolean", editable: true, itemCount: undefined },
      { key: "tags", kind: "scalar-list", editable: true, itemCount: 2 },
      { key: "owner", kind: "mapping", editable: false, itemCount: 1 },
      { key: "sources", kind: "structured-list", editable: false, itemCount: 1 },
    ]);
  });

  it("distinguishes missing and invalid frontmatter from an empty valid mapping", () => {
    expect(getFrontmatterProperties("# Body")).toMatchObject({
      status: "absent",
      properties: [],
      bodyOffset: 0,
    });
    expect(getFrontmatterProperties("---\ntitle: [\n---\nBody")).toMatchObject({
      status: "invalid",
      properties: [],
    });
    expect(getFrontmatterProperties("---\n---\nBody")).toMatchObject({
      status: "valid",
      properties: [],
    });
  });

  it("does not offer ambiguous inline editing for mixed scalar lists", () => {
    expect(getFrontmatterProperties("---\nmixed: [one, 2, true]\n---\nBody").properties[0])
      .toMatchObject({ kind: "scalar-list", editable: false, itemCount: 3 });
  });
});
