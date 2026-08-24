import { describe, expect, it } from "vitest";
import {
  convertFrontmatterPropertyValue,
  formatFrontmatterPropertyDraft,
  getFrontmatterProperties,
  parseFrontmatterPropertyDraft,
} from "./frontmatterProperties";

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
    expect(model.properties.map(({ key, kind, type, itemCount }) => ({
      key,
      kind,
      type,
      itemCount,
    }))).toEqual([
      { key: "title", kind: "text", type: "text", itemCount: undefined },
      { key: "priority", kind: "number", type: "number", itemCount: undefined },
      { key: "published", kind: "boolean", type: "checkbox", itemCount: undefined },
      { key: "tags", kind: "scalar-list", type: "list", itemCount: 2 },
      { key: "owner", kind: "mapping", type: "object", itemCount: 1 },
      { key: "sources", kind: "structured-list", type: "list", itemCount: 1 },
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

  it("keeps mixed scalar lists available to the structured list editor", () => {
    expect(getFrontmatterProperties("---\nmixed: [one, 2, true]\n---\nBody").properties[0])
      .toMatchObject({ kind: "scalar-list", type: "list", itemCount: 3 });
  });

  it("recognizes date values without imposing field names", () => {
    expect(getFrontmatterProperties("---\nreview_on: 2026-08-24\n---\nBody").properties[0])
      .toMatchObject({ kind: "date", type: "date", value: "2026-08-24" });
  });

  it("round-trips structured list and object drafts", () => {
    const list = [{ by: "human:taeha", at: "2026-08-24" }];
    const listDraft = formatFrontmatterPropertyDraft(list, "list");
    expect(parseFrontmatterPropertyDraft(listDraft, "list")).toEqual({ ok: true, value: list });

    const object = { team: "platform", required: true };
    const objectDraft = formatFrontmatterPropertyDraft(object, "object");
    expect(parseFrontmatterPropertyDraft(objectDraft, "object")).toEqual({ ok: true, value: object });
  });

  it("uses explicit, reversible value conversions for type changes", () => {
    expect(convertFrontmatterPropertyValue("42", "number")).toEqual({ ok: true, value: 42 });
    expect(convertFrontmatterPropertyValue("not-a-number", "number")).toEqual({ ok: false });
    expect(convertFrontmatterPropertyValue("draft", "list")).toEqual({
      ok: true,
      value: ["draft"],
    });
    expect(convertFrontmatterPropertyValue("draft", "object")).toEqual({
      ok: true,
      value: { value: "draft" },
    });
    expect(convertFrontmatterPropertyValue("draft", "date", "2026-08-24")).toEqual({
      ok: true,
      value: "2026-08-24",
    });
  });
});
