import { describe, expect, it } from "vitest";
import { filterComboboxOptions, type ComboboxOption } from "./Combobox";

const options: ComboboxOption[] = [
  { label: "Title", value: "title" },
  { label: "Generated", value: "generated", description: "Provenance" },
];

describe("filterComboboxOptions", () => {
  it("returns every option for an empty query", () => {
    expect(filterComboboxOptions(options, "")).toEqual(options);
  });

  it("matches labels, values, and descriptions without case sensitivity", () => {
    expect(filterComboboxOptions(options, "TITLE")).toEqual([options[0]]);
    expect(filterComboboxOptions(options, "provenance")).toEqual([options[1]]);
  });

  it("keeps arbitrary values possible by returning no forced match", () => {
    expect(filterComboboxOptions(options, "team_specific_field")).toEqual([]);
  });
});
