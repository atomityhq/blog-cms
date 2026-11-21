import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MultiSelect, type MultiSelectOption } from "./MultiSelect";

describe("MultiSelect", () => {
  it("renders a chip for a newly created option once included in options", () => {
    const initialOptions: MultiSelectOption[] = [{ id: "author-1", label: "Ada Lovelace" }];
    const withCreatedOption: MultiSelectOption[] = [
      ...initialOptions,
      { id: "author-new", label: "Grace Hopper" },
    ];

    const html = renderToStaticMarkup(
      <MultiSelect
        id="authors"
        options={withCreatedOption}
        value={["author-new"]}
        onChange={() => {}}
      />,
    );

    expect(html).toContain("Grace Hopper");
    expect(html).toContain('aria-label="Remove Grace Hopper"');
  });

  it("omits chips whose ids are not in options", () => {
    const initialOptions: MultiSelectOption[] = [{ id: "author-1", label: "Ada Lovelace" }];

    const html = renderToStaticMarkup(
      <MultiSelect
        id="authors"
        options={initialOptions}
        value={["author-missing"]}
        onChange={() => {}}
      />,
    );

    expect(html).not.toContain("author-missing");
  });
});