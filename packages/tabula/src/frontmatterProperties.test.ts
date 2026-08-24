import { describe, expect, it } from "vitest";
import {
  convertFrontmatterPropertyValue,
  formatFrontmatterPropertyDraft,
  getFrontmatterProperties,
  getFrontmatterValueAtPath,
  getFrontmatterValueType,
  parseFrontmatterPropertyDraft,
  removeFrontmatterValueAtPath,
  renameFrontmatterValuePathKey,
  updateFrontmatterValueAtPath,
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
    expect(getFrontmatterProperties(
      "---\nstale_after: 2026-08-24T09:30:00+09:00\n---\nBody",
    ).properties[0]).toMatchObject({
      kind: "datetime",
      type: "datetime",
      value: "2026-08-24T09:30:00+09:00",
    });
    expect(getFrontmatterProperties("---\nreviewed_at: 2026-08-24T09:30:00\n---\nBody")
      .properties[0]).toMatchObject({ kind: "text", type: "text" });
  });

  it("preserves null as an explicit YAML value kind", () => {
    expect(getFrontmatterProperties("---\nowner: null\n---\nBody").properties[0])
      .toMatchObject({ kind: "empty", type: "empty", value: null });
    expect(parseFrontmatterPropertyDraft("", "empty")).toEqual({ ok: true, value: null });
    expect(convertFrontmatterPropertyValue("owner", "empty")).toEqual({
      ok: true,
      value: null,
    });
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
    expect(convertFrontmatterPropertyValue(undefined, "number")).toEqual({
      ok: true,
      value: 0,
    });
    expect(convertFrontmatterPropertyValue(undefined, "checkbox")).toEqual({
      ok: true,
      value: false,
    });
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
    expect(convertFrontmatterPropertyValue(
      "draft",
      "datetime",
      "2026-08-24",
      "2026-08-24T09:30:00+09:00",
    )).toEqual({ ok: true, value: "2026-08-24T09:30:00+09:00" });
  });

  it("updates and removes nested values without mutating the original value", () => {
    const original = {
      owner: { team: "platform", required: true },
      sources: [{ id: "handbook", verified: false }],
    };
    const updated = updateFrontmatterValueAtPath(
      original,
      ["sources", 0, "verified"],
      true,
    );

    expect(updated).toEqual({
      ok: true,
      value: {
        owner: { team: "platform", required: true },
        sources: [{ id: "handbook", verified: true }],
      },
    });
    expect(getFrontmatterValueAtPath(original, ["sources", 0, "verified"]))
      .toBe(false);
    expect(updated.ok && removeFrontmatterValueAtPath(updated.value, ["owner", "required"]))
      .toEqual({
        ok: true,
        value: {
          owner: { team: "platform" },
          sources: [{ id: "handbook", verified: true }],
        },
      });
  });

  it("renames nested mapping keys in place and rejects duplicates", () => {
    const original = { owner: { team: "platform", required: true } };
    expect(renameFrontmatterValuePathKey(original, ["owner", "team"], "group"))
      .toEqual({
        ok: true,
        value: { owner: { group: "platform", required: true } },
      });
    expect(renameFrontmatterValuePathKey(original, ["owner", "team"], "required"))
      .toEqual({ ok: false, reason: "duplicate_key" });
  });

  it("infers types for values at every nesting level", () => {
    expect(getFrontmatterValueType("2026-08-24")).toBe("date");
    expect(getFrontmatterValueType("2026-08-24T09:30:00Z")).toBe("datetime");
    expect(getFrontmatterValueType(null)).toBe("empty");
    expect(getFrontmatterValueType([{ id: "source" }])).toBe("list");
    expect(getFrontmatterValueType({ id: "source" })).toBe("object");
  });
});
