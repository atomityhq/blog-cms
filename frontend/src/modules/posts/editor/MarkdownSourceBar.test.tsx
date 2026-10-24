import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MarkdownSourceBar } from "./MarkdownSourceBar";

const source = { id: "source", fileName: "post.md", sizeBytes: 6, url: "/source" };
function buttons(disabled: boolean, uploading = false, empty = false) {
  const markup = renderToStaticMarkup(createElement(MarkdownSourceBar, {
    source: empty ? null : source, disabled, uploading, onImport: vi.fn(), onRemove: vi.fn(),
  }));
  return markup.match(/<button\b[^>]*>/g) ?? [];
}

describe("Markdown attachment controls", () => {
  it("disables both Replace and Remove while a post is saving", () => {
    const controls = buttons(true);
    expect(controls).toHaveLength(2);
    expect(controls.every(button => button.includes("disabled"))).toBe(true);
  });
  it("disables the initial import while saving a first-time post", () => {
    expect(buttons(true, false, true)).toHaveLength(1);
    expect(buttons(true, false, true)[0]).toContain("disabled");
  });
  it("also disables controls during import and enables them when idle", () => {
    expect(buttons(false, true).every(button => button.includes("disabled"))).toBe(true);
    expect(buttons(false).every(button => !button.includes("disabled"))).toBe(true);
  });
});
